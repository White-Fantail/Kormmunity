'use server';

import { AccountType, UserStatus, StaffRole } from '@prisma/client';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';

import { getSessionCookieName, invalidateSessionCache } from '@/lib/auth/session';
import { isMissingStaffAssignmentTableError } from '@/lib/auth/staff-assignments';
import { prisma } from '@/lib/db/prisma';
import { safeMcpLoginNext } from '@/lib/mcp/post-login';

const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSessionMaxAgeSeconds() {
  const parsed = Number(process.env.SESSION_MAX_AGE_SECONDS);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }

  return DEFAULT_SESSION_MAX_AGE_SECONDS;
}

const STAFF_ROLES = new Set<StaffRole>([
  'MODERATOR',
  'COORDINATOR',
  'AD_MANAGER',
  'PARTNER_MANAGER',
  'ADMIN',
]);

/**
 * Dev-only fallback login used when Kakao OAuth environment variables are not configured.
 * Keep this boundary stable so the rest of the app can switch auth providers safely.
 */
export async function loginWithKakaoPlaceholder(formData: FormData) {
  const kakaoId = String(formData.get('kakaoId') || '').trim();
  const displayName = String(formData.get('displayName') || '').trim();
  const roleInput = String(formData.get('role') || '').trim().toUpperCase();

  if (!kakaoId || !displayName) {
    redirect('/login?error=missing');
  }

  const staffRole: StaffRole | null = STAFF_ROLES.has(roleInput as StaffRole)
    ? (roleInput as StaffRole)
    : null;

  const existingUser = await prisma.user.findUnique({
    where: { kakaoId },
    select: { id: true, isManagedAccount: true, isActive: true, status: true },
  });

  if (existingUser?.isManagedAccount || existingUser?.isActive === false || existingUser?.status === 'DELETED') {
    redirect('/login?error=forbidden');
  }

  const user = await prisma.user.upsert({
    where: { kakaoId },
    update: {
      displayName,
      accountType: AccountType.REAL_USER,
      isManagedAccount: false,
      isActive: true,
    },
    create: {
      kakaoId,
      displayName,
      accountType: AccountType.REAL_USER,
      isManagedAccount: false,
      isActive: true,
      status: UserStatus.ACTIVE,
    },
    select: { id: true, countryId: true },
  });

  // Sync StaffAssignment for dev login: ensure a global assignment matches the desired role
  try {
    if (staffRole) {
      const existing = await prisma.staffAssignment.findFirst({
        where: {
          userId: user.id,
          role: staffRole,
          countryId: null,
          cityId: null,
        },
        select: { id: true, isActive: true },
      });

      if (existing) {
        if (!existing.isActive) {
          await prisma.staffAssignment.update({
            where: { id: existing.id },
            data: { isActive: true },
          });
        }
      } else {
        await prisma.staffAssignment.create({
          data: {
            userId: user.id,
            role: staffRole,
            countryId: null,
            cityId: null,
            isActive: true,
          },
        });
      }
    } else {
      // Deactivate all assignments when logging in as USER role
      await prisma.staffAssignment.updateMany({
        where: { userId: user.id, isActive: true },
        data: { isActive: false },
      });
    }
  } catch (error) {
    if (!isMissingStaffAssignmentTableError(error)) {
      throw error;
    }
  }

  const token = randomUUID();
  const sessionMaxAgeSeconds = getSessionMaxAgeSeconds();
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000);

  await prisma.session.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionMaxAgeSeconds,
  });

  redirect(safeMcpLoginNext(formData.get('next')) ?? (user.countryId ? '/posts' : '/select-country'));
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;

  if (token) {
    invalidateSessionCache(token);
    await prisma.session.deleteMany({
      where: { token },
    });
  }

  cookieStore.delete(getSessionCookieName());
  redirect('/posts');
}
