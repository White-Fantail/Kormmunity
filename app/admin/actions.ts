'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import {
  AccountType,
  CategoryType,
  CategoryVisibilityMode,
  Prisma,
  PermissionSubjectType,
} from '@prisma/client';

import { requireUser, invalidateSessionCache } from '@/lib/auth/session';
import { isMissingStaffAssignmentTableError } from '@/lib/auth/staff-assignments';
import { prisma } from '@/lib/db/prisma';
import { canMakeFinalUserDecision, STAFF_ROLES, USER_ROLES } from '@/lib/permissions';
import { getPostCategoryModerationResult } from '@/lib/posts/post-category-moderation';
import type { SessionUser } from '@/lib/auth/types';
import type { StaffRole, UserStatus } from '@prisma/client';
import {
  applyCommunityScoreChange,
} from '@/lib/community-score';
import { applyUserWarmthDelta } from '@/lib/neighbour-warmth/update';
import {
  REPUTATION_SETTING_DEFAULTS,
  REPUTATION_SETTING_FIELDS,
  type ReputationSettingKey,
} from '@/lib/reputation-settings';

const VALID_CATEGORY_TYPES = Object.values(CategoryType) as CategoryType[];
const VALID_CATEGORY_VISIBILITY_MODES = Object.values(
  CategoryVisibilityMode,
) as CategoryVisibilityMode[];
const VALID_ACCOUNT_TYPES = Object.values(AccountType) as AccountType[];
const MANAGED_ACCOUNT_TYPES = new Set<AccountType>(['PERSONA', 'OPERATOR', 'SYSTEM']);
const MANAGED_ACCOUNTS_PATH = '/admin/managed-accounts';
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function normalizeHexColor(value: string) {
  if (!value) return null;
  const normalized = value.startsWith('#') ? value : `#${value}`;
  return HEX_COLOR_PATTERN.test(normalized) ? normalized : null;
}

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAdminReturnTo(value: FormDataEntryValue | null, fallbackPath: `/${string}`): string {
  const candidate = normalizeText(value);
  if (!candidate || !candidate.startsWith('/admin')) {
    return fallbackPath;
  }

  return candidate;
}

function parseBoolean(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return null;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return null;
}

function parseAccountType(value: string): AccountType | null {
  if (!value) {
    return null;
  }

  if (!VALID_ACCOUNT_TYPES.includes(value as AccountType)) {
    return null;
  }

  return value as AccountType;
}

function shouldBeManagedAccount(accountType: AccountType) {
  return MANAGED_ACCOUNT_TYPES.has(accountType);
}

function redirectWithQuery(path: string, query: Record<string, string>): never {
  const searchParams = new URLSearchParams(query);
  redirect(`${path}?${searchParams.toString()}`);
}

function normalizeQuickCommentTemplates(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return [];
  return value
    .split(/\r?\n/)
    .map((template) => template.trim())
    .filter((template) => template.length > 0);
}

function requireAdmin(user: SessionUser | null) {
  if (!user || !canMakeFinalUserDecision(user)) {
    redirect('/posts?error=권한이 없습니다.');
  }
}

function redirectIfStaffAssignmentTableMissing(error: unknown): never | void {
  if (isMissingStaffAssignmentTableError(error)) {
    redirect('/admin/users?error=스태프 권한 테이블이 아직 준비되지 않았습니다. 마이그레이션 후 다시 시도해 주세요.');
  }
}

async function logModerationAction(
  actorId: string,
  targetType: string,
  targetId: string,
  actionType: string,
  reason?: string,
) {
  await prisma.moderationAction.create({
    data: {
      actorId,
      targetType,
      targetId,
      actionType,
      reason: reason || null,
    },
  });
}

async function revalidateUserSessions(userId: string) {
  const sessions = await prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: { token: true },
  });
  for (const session of sessions) {
    invalidateSessionCache(session.token);
  }
}

async function resolveManagedAccountLocation(
  rawCountryId: string,
  rawCityId: string,
  errorRedirectPath: string,
): Promise<{ countryId: string | null; cityId: string | null }> {
  const countryId = rawCountryId || null;
  const cityId = rawCityId || null;

  const [country, city] = await Promise.all([
    countryId
      ? prisma.country.findFirst({
          where: { id: countryId, isActive: true },
          select: { id: true },
        })
      : Promise.resolve(null),
    cityId
      ? prisma.city.findFirst({
          where: { id: cityId, isActive: true },
          select: { id: true, countryId: true },
        })
      : Promise.resolve(null),
  ]);

  if (countryId && !country) {
    redirectWithQuery(errorRedirectPath, { error: '유효하지 않은 국가입니다.' });
  }

  if (cityId && !city) {
    redirectWithQuery(errorRedirectPath, { error: '유효하지 않은 도시입니다.' });
  }

  if (city && countryId && city.countryId !== countryId) {
    redirectWithQuery(errorRedirectPath, { error: '도시와 국가가 일치하지 않습니다.' });
  }

  return {
    countryId: city?.countryId ?? countryId,
    cityId,
  };
}

export async function addStaffAssignmentAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const targetUserId = normalizeText(formData.get('targetUserId'));
  const role = normalizeText(formData.get('role')) as StaffRole;
  const countryId = normalizeText(formData.get('countryId')) || null;
  const cityId = normalizeText(formData.get('cityId')) || null;

  if (!targetUserId || !role) {
    redirect('/admin/users?error=잘못된 요청입니다.');
  }

  if (!(STAFF_ROLES as readonly string[]).includes(role)) {
    redirect('/admin/users?error=유효하지 않은 스태프 역할입니다.');
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });

  if (!targetUser) {
    redirect('/admin/users?error=사용자를 찾을 수 없습니다.');
  }

  let assignment: { id: string };
  try {
    // Check for existing active assignment with same scope
    const existingAssignment = await prisma.staffAssignment.findFirst({
      where: {
        userId: targetUserId,
        role,
        countryId: countryId ?? null,
        cityId: cityId ?? null,
        isActive: true,
      },
      select: { id: true },
    });

    if (existingAssignment) {
      redirect(`/admin/users?error=${encodeURIComponent('이미 동일한 스태프 권한이 존재합니다.')}`);
    }

    assignment = await prisma.staffAssignment.create({
      data: {
        userId: targetUserId,
        role,
        countryId,
        cityId,
        isActive: true,
      },
      select: { id: true },
    });
  } catch (error) {
    redirectIfStaffAssignmentTableMissing(error);
    throw error;
  }

  await logModerationAction(
    user.id,
    'USER',
    targetUserId,
    `STAFF_ASSIGNMENT_ADDED_${role}`,
    JSON.stringify({ assignmentId: assignment.id, role, countryId, cityId }),
  );

  revalidatePath('/admin/users');
  await revalidateUserSessions(targetUserId);
  redirect('/admin/users');
}

export async function deactivateStaffAssignmentAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const assignmentId = normalizeText(formData.get('assignmentId'));

  if (!assignmentId) {
    redirect('/admin/users?error=잘못된 요청입니다.');
  }

  let assignment:
    | {
        id: string;
        userId: string;
        role: StaffRole;
        isActive: boolean;
      }
    | null = null;
  try {
    assignment = await prisma.staffAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, userId: true, role: true, isActive: true },
    });
  } catch (error) {
    redirectIfStaffAssignmentTableMissing(error);
    throw error;
  }

  if (!assignment) {
    redirect('/admin/users?error=스태프 권한을 찾을 수 없습니다.');
  }

  if (!assignment.isActive) {
    redirect(`/admin/users?error=${encodeURIComponent('이미 비활성화된 스태프 권한입니다.')}`);
  }

  try {
    await prisma.staffAssignment.update({
      where: { id: assignmentId },
      data: { isActive: false },
    });
  } catch (error) {
    redirectIfStaffAssignmentTableMissing(error);
    throw error;
  }

  await logModerationAction(
    user.id,
    'USER',
    assignment.userId,
    `STAFF_ASSIGNMENT_DEACTIVATED_${assignment.role}`,
    JSON.stringify({ assignmentId }),
  );

  revalidatePath('/admin/users');
  await revalidateUserSessions(assignment.userId);
  redirect('/admin/users');
}

export async function deleteStaffAssignmentAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const assignmentId = normalizeText(formData.get('assignmentId'));

  if (!assignmentId) {
    redirect('/admin/users?error=잘못된 요청입니다.');
  }

  let assignment:
    | {
        id: string;
        userId: string;
        role: StaffRole;
      }
    | null = null;
  try {
    assignment = await prisma.staffAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, userId: true, role: true },
    });
  } catch (error) {
    redirectIfStaffAssignmentTableMissing(error);
    throw error;
  }

  if (!assignment) {
    redirect('/admin/users?error=스태프 권한을 찾을 수 없습니다.');
  }

  try {
    await prisma.staffAssignment.delete({ where: { id: assignmentId } });
  } catch (error) {
    redirectIfStaffAssignmentTableMissing(error);
    throw error;
  }

  await logModerationAction(
    user.id,
    'USER',
    assignment.userId,
    `STAFF_ASSIGNMENT_DELETED_${assignment.role}`,
    JSON.stringify({ assignmentId }),
  );

  revalidatePath('/admin/users');
  await revalidateUserSessions(assignment.userId);
  redirect('/admin/users');
}

export async function changeUserStatusAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const targetUserId = normalizeText(formData.get('targetUserId'));
  const newStatus = normalizeText(formData.get('status')) as UserStatus;
  const reason = normalizeText(formData.get('reason'));

  if (!targetUserId || !newStatus) {
    redirect('/admin/users?error=잘못된 요청입니다.');
  }

  const validStatuses: UserStatus[] = ['ACTIVE', 'LIMITED', 'SUSPENDED', 'DELETED'];
  if (!validStatuses.includes(newStatus)) {
    redirect('/admin/users?error=유효하지 않은 상태입니다.');
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, status: true },
  });

  if (!targetUser) {
    redirect('/admin/users?error=사용자를 찾을 수 없습니다.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: targetUserId },
      data: { status: newStatus },
    });

    await tx.moderationAction.create({
      data: {
        actorId: user.id,
        targetType: 'USER',
        targetId: targetUserId,
        actionType: `STATUS_CHANGE_TO_${newStatus}`,
        reason: reason || null,
      },
    });
  });

  revalidatePath('/admin/users');
  await revalidateUserSessions(targetUserId);
  redirect('/admin/users');
}

export async function changeUserAccountTypeAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const targetUserId = normalizeText(formData.get('targetUserId'));
  const accountType = parseAccountType(normalizeText(formData.get('accountType')));
  const reason = normalizeText(formData.get('reason'));

  if (!targetUserId || !accountType) {
    redirect('/admin/users?error=유효한 계정 타입 변경 요청이 아닙니다.');
  }

  if (targetUserId === user.id) {
    redirect('/admin/users?error=본인 계정의 타입은 변경할 수 없습니다.');
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, accountType: true, isManagedAccount: true, isActive: true },
  });

  if (!targetUser) {
    redirect('/admin/users?error=사용자를 찾을 수 없습니다.');
  }

  const nextIsManagedAccount = shouldBeManagedAccount(accountType);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: targetUserId },
      data: {
        accountType,
        isManagedAccount: nextIsManagedAccount,
        isActive: nextIsManagedAccount ? true : targetUser.isActive,
      },
    });

    await tx.moderationAction.create({
      data: {
        actorId: user.id,
        targetType: 'USER',
        targetId: targetUserId,
        actionType: `ACCOUNT_TYPE_CHANGE_TO_${accountType}`,
        reason: reason || null,
      },
    });
  });

  revalidatePath('/admin/users');
  revalidatePath(MANAGED_ACCOUNTS_PATH);
  revalidatePath('/posts/new');
  await revalidateUserSessions(targetUserId);
  redirect('/admin/users');
}

export async function createManagedAccountAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const displayName = normalizeText(formData.get('displayName'));
  const parsedAccountType = parseAccountType(normalizeText(formData.get('accountType')));
  const accountType =
    parsedAccountType === 'PERSONA' || parsedAccountType === 'OPERATOR'
      ? parsedAccountType
      : null;
  const rawCountryId = normalizeText(formData.get('countryId'));
  const rawCityId = normalizeText(formData.get('cityId'));
  const profileImageUrl = normalizeText(formData.get('profileImageUrl')) || null;
  const shortBio = normalizeText(formData.get('shortBio')) || null;
  const isActive = parseBoolean(formData.get('isActive')) ?? true;
  const personaNotes = normalizeText(formData.get('personaNotes')) || null;
  const toneNotes = normalizeText(formData.get('toneNotes')) || null;
  const activityNotes = normalizeText(formData.get('activityNotes')) || null;
  const returnTo = normalizeAdminReturnTo(formData.get('returnTo'), MANAGED_ACCOUNTS_PATH);

  if (!displayName || !accountType) {
    redirectWithQuery(returnTo, {
      error: '닉네임과 계정 타입(PERSONA/OPERATOR)을 입력해 주세요.',
    });
  }

  const { countryId, cityId } = await resolveManagedAccountLocation(rawCountryId, rawCityId, returnTo);

  const created = await prisma.user.create({
    data: {
      kakaoId: `managed-${accountType.toLowerCase()}-${randomUUID()}`,
      displayName,
      status: 'ACTIVE',
      accountType,
      isManagedAccount: true,
      isActive,
      countryId,
      cityId,
      profileImageUrl,
      shortBio,
      personaNotes,
      toneNotes,
      activityNotes,
    },
    select: {
      id: true,
      displayName: true,
      accountType: true,
      isActive: true,
    },
  });

  await logModerationAction(
    user.id,
    'MANAGED_ACCOUNT',
    created.id,
    'MANAGED_ACCOUNT_CREATED',
    JSON.stringify({
      after: {
        displayName: created.displayName,
        accountType: created.accountType,
        isActive: created.isActive,
        countryId,
        cityId,
      },
    }),
  );

  revalidatePath(MANAGED_ACCOUNTS_PATH);
  revalidatePath('/posts/new');
  redirect(returnTo);
}

export async function updateManagedAccountAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const targetUserId = normalizeText(formData.get('targetUserId'));
  const displayName = normalizeText(formData.get('displayName'));
  const parsedAccountType = parseAccountType(normalizeText(formData.get('accountType')));
  const accountType =
    parsedAccountType === 'PERSONA' || parsedAccountType === 'OPERATOR'
      ? parsedAccountType
      : null;
  const rawCountryId = normalizeText(formData.get('countryId'));
  const rawCityId = normalizeText(formData.get('cityId'));
  const profileImageUrl = normalizeText(formData.get('profileImageUrl')) || null;
  const shortBio = normalizeText(formData.get('shortBio')) || null;
  const isActive = parseBoolean(formData.get('isActive'));
  const personaNotes = normalizeText(formData.get('personaNotes')) || null;
  const toneNotes = normalizeText(formData.get('toneNotes')) || null;
  const activityNotes = normalizeText(formData.get('activityNotes')) || null;
  const returnTo = normalizeAdminReturnTo(formData.get('returnTo'), MANAGED_ACCOUNTS_PATH);

  if (!targetUserId || !displayName || !accountType || isActive === null) {
    redirectWithQuery(returnTo, { error: '운영 계정 수정 요청 값이 올바르지 않습니다.' });
  }

  const { countryId, cityId } = await resolveManagedAccountLocation(rawCountryId, rawCityId, returnTo);

  const existing = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      displayName: true,
      accountType: true,
      isManagedAccount: true,
      isActive: true,
      countryId: true,
      cityId: true,
      profileImageUrl: true,
      shortBio: true,
      personaNotes: true,
      toneNotes: true,
      activityNotes: true,
    },
  });

  if (
    !existing ||
    !existing.isManagedAccount ||
    (existing.accountType !== 'PERSONA' && existing.accountType !== 'OPERATOR')
  ) {
    redirectWithQuery(returnTo, { error: '수정 가능한 운영 계정을 찾을 수 없습니다.' });
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      displayName,
      accountType,
      isManagedAccount: true,
      isActive,
      countryId,
      cityId,
      profileImageUrl,
      shortBio,
      personaNotes,
      toneNotes,
      activityNotes,
    },
    select: {
      id: true,
      displayName: true,
      accountType: true,
      isActive: true,
      countryId: true,
      cityId: true,
      profileImageUrl: true,
      shortBio: true,
      personaNotes: true,
      toneNotes: true,
      activityNotes: true,
    },
  });

  const actionType =
    existing.isActive !== updated.isActive
      ? updated.isActive
        ? 'MANAGED_ACCOUNT_REACTIVATED'
        : 'MANAGED_ACCOUNT_DEACTIVATED'
      : 'MANAGED_ACCOUNT_UPDATED';

  await logModerationAction(
    user.id,
    'MANAGED_ACCOUNT',
    targetUserId,
    actionType,
    JSON.stringify({
      before: existing,
      after: updated,
    }),
  );

  revalidatePath(MANAGED_ACCOUNTS_PATH);
  revalidatePath('/posts/new');
  redirect(returnTo);
}

export async function adminDeletePostAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const postId = normalizeText(formData.get('postId'));
  const reason = normalizeText(formData.get('reason'));

  if (!postId) {
    redirect('/admin/posts?error=게시글 ID가 없습니다.');
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true, authorId: true },
  });

  if (!post) {
    redirect('/admin/posts?error=게시글을 찾을 수 없습니다.');
  }

  if (post.status === 'DELETED') {
    redirect(`/admin/posts?error=${encodeURIComponent('이미 삭제된 게시글입니다.')}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: {
        status: 'DELETED',
        isPinned: false,
        pinnedAt: null,
        deletedAt: new Date(),
        deletedReason: reason || 'ADMIN_DELETED',
      },
    });

    await tx.moderationAction.create({
      data: {
        actorId: user.id,
        targetType: 'POST',
        targetId: postId,
        actionType: 'ADMIN_DELETE',
        reason: reason || null,
      },
    });
  });

  void applyCommunityScoreChange({
    targetType: 'POST',
    targetId: postId,
    actorId: user.id,
    reason: 'ADMIN_DELETES',
  }).catch((err) => {
    console.error('[adminDeletePostAction] community score update failed', err);
  });

  void applyUserWarmthDelta(post.authorId, 'ADMIN_DELETES').catch(
    (err) => {
      console.error('[adminDeletePostAction] neighbour warmth update failed', err);
    },
  );

  revalidatePath('/admin/posts');
  revalidatePath('/moderator');
  revalidatePath('/posts');
  revalidatePath(`/posts/${postId}`);
  redirect('/admin/posts');
}

export async function adminRestorePostAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const postId = normalizeText(formData.get('postId'));
  const reason = normalizeText(formData.get('reason'));

  if (!postId) {
    redirect('/admin/posts?error=게시글 ID가 없습니다.');
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true },
  });

  if (!post) {
    redirect('/admin/posts?error=게시글을 찾을 수 없습니다.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: {
        status: 'PUBLISHED',
        // Intentionally keep restored posts unpinned after any HELD/DELETED transition.
        isPinned: false,
        pinnedAt: null,
        heldAt: null,
        heldReason: null,
      },
    });

    await tx.moderationAction.create({
      data: {
        actorId: user.id,
        targetType: 'POST',
        targetId: postId,
        actionType: 'ADMIN_RESTORE',
        reason: reason || null,
      },
    });
  });

  void applyCommunityScoreChange({
    targetType: 'POST',
    targetId: postId,
    actorId: user.id,
    reason: 'ADMIN_RESTORES',
  }).catch((err) => {
    console.error('[adminRestorePostAction] community score update failed', err);
  });

  revalidatePath('/admin/posts');
  revalidatePath('/moderator');
  revalidatePath('/posts');
  revalidatePath(`/posts/${postId}`);
  redirect('/admin/posts');
}

export async function pinPostAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const postId = normalizeText(formData.get('postId'));

  if (!postId) {
    redirect('/admin/posts?error=게시글 ID가 없습니다.');
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true, isPinned: true },
  });

  if (!post) {
    redirect('/admin/posts?error=게시글을 찾을 수 없습니다.');
  }

  if (post.status !== 'PUBLISHED') {
    redirect('/admin/posts?error=게시된 글만 고정할 수 있습니다.');
  }

  if (post.isPinned) {
    redirect(`/admin/posts?success=${encodeURIComponent('이미 상단 고정된 게시글입니다.')}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: {
        isPinned: true,
        pinnedAt: new Date(),
      },
    });

    await tx.moderationAction.create({
      data: {
        actorId: user.id,
        targetType: 'POST',
        targetId: postId,
        actionType: 'PIN_POST',
      },
    });
  });

  revalidatePath('/admin/posts');
  revalidatePath('/posts');
  revalidatePath(`/posts/${postId}`);
  redirect(`/admin/posts?success=${encodeURIComponent('게시글을 상단에 고정했어요.')}`);
}

export async function adminChangePostCategoryAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const postId = normalizeText(formData.get('postId'));
  const categoryId = normalizeText(formData.get('categoryId'));

  if (!postId || !categoryId) {
    redirect('/admin/posts?error=게시글 또는 카테고리 정보가 없습니다.');
  }

  const [post, nextCategory] = await Promise.all([
    prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        price: true,
        category: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    }),
    prisma.category.findFirst({
      where: { id: categoryId, isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
      },
    }),
  ]);

  if (!post) {
    redirect('/admin/posts?error=게시글을 찾을 수 없습니다.');
  }

  if (!nextCategory) {
    redirect('/admin/posts?error=변경할 카테고리를 찾을 수 없습니다.');
  }

  const changeResult = getPostCategoryModerationResult({
    currentCategory: post.category,
    nextCategory,
    hasPrice: post.price !== null,
  });

  if (!changeResult.ok) {
    redirect(`/admin/posts?error=${encodeURIComponent(changeResult.message)}`);
  }

  if (changeResult.noop) {
    redirect(`/admin/posts?success=${encodeURIComponent('이미 해당 카테고리로 설정된 글입니다.')}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: {
        categoryId: nextCategory.id,
        price: changeResult.clearPrice ? null : undefined,
      },
    });

    if (changeResult.clearTags) {
      await tx.postTag.deleteMany({
        where: { postId },
      });
    }

    await tx.moderationAction.create({
      data: {
        actorId: user.id,
        targetType: 'POST',
        targetId: postId,
        actionType: 'CHANGE_CATEGORY',
        reason: JSON.stringify({
          fromCategoryId: post.category.id,
          fromCategoryName: post.category.name,
          fromCategoryType: post.category.type,
          toCategoryId: nextCategory.id,
          toCategoryName: nextCategory.name,
          toCategoryType: nextCategory.type,
          clearedPrice: changeResult.clearPrice,
          clearedTags: changeResult.clearTags,
        }),
      },
    });
  });

  revalidatePath('/admin/posts');
  revalidatePath('/moderator');
  revalidatePath('/posts');
  revalidatePath('/my/posts');
  revalidatePath(`/posts/${postId}`);
  redirect(`/admin/posts?success=${encodeURIComponent('게시글 카테고리를 변경했어요.')}`);
}

export async function unpinPostAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const postId = normalizeText(formData.get('postId'));

  if (!postId) {
    redirect('/admin/posts?error=게시글 ID가 없습니다.');
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, isPinned: true },
  });

  if (!post) {
    redirect('/admin/posts?error=게시글을 찾을 수 없습니다.');
  }

  if (!post.isPinned) {
    redirect(`/admin/posts?success=${encodeURIComponent('이미 고정 해제된 게시글입니다.')}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: {
        isPinned: false,
        pinnedAt: null,
      },
    });

    await tx.moderationAction.create({
      data: {
        actorId: user.id,
        targetType: 'POST',
        targetId: postId,
        actionType: 'UNPIN_POST',
      },
    });
  });

  revalidatePath('/admin/posts');
  revalidatePath('/posts');
  revalidatePath(`/posts/${postId}`);
  redirect(`/admin/posts?success=${encodeURIComponent('게시글 상단 고정을 해제했어요.')}`);
}

export async function createCategoryAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const name = normalizeText(formData.get('name'));
  const slug = normalizeText(formData.get('slug'));
  const type = normalizeText(formData.get('type')) as CategoryType;
  const visibilityMode = normalizeText(formData.get('visibilityMode')) as CategoryVisibilityMode;
  const colorValue = normalizeText(formData.get('color'));
  const requireCommentBeforeContactDefault =
    formData.get('requireCommentBeforeContactDefault') === 'on';
  const contactSectionDefaultExpanded = formData.get('contactSectionDefaultExpanded') === 'on';
  const quickCommentTemplates = normalizeQuickCommentTemplates(
    formData.get('quickCommentTemplates'),
  );
  const color = normalizeHexColor(colorValue);

  if (!name || !slug || !type || !visibilityMode) {
    redirect('/admin/categories?error=이름, 슬러그, 타입, 노출 방식을 입력해 주세요.');
  }

  if (!VALID_CATEGORY_TYPES.includes(type)) {
    redirect('/admin/categories?error=유효하지 않은 카테고리 타입입니다.');
  }

  if (!VALID_CATEGORY_VISIBILITY_MODES.includes(visibilityMode)) {
    redirect('/admin/categories?error=유효하지 않은 카테고리 노출 방식입니다.');
  }

  if (colorValue && !color) {
    redirect('/admin/categories?error=카테고리 색상은 #RRGGBB 형식이어야 합니다.');
  }

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) {
    redirect('/admin/categories?error=이미 존재하는 슬러그입니다.');
  }

  const sortOrder = await prisma.category.count();

  await prisma.category.create({
    data: {
      name,
      slug,
      type,
      visibilityMode,
      sortOrder,
      color,
      requireCommentBeforeContactDefault,
      contactSectionDefaultExpanded,
      quickCommentTemplates:
        quickCommentTemplates.length > 0 ? quickCommentTemplates : Prisma.DbNull,
    },
  });

  revalidatePath('/admin/categories');
  redirect('/admin/categories');
}

export async function toggleCategoryActiveAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const categoryId = normalizeText(formData.get('categoryId'));
  const isActive = formData.get('isActive') === 'true';

  if (!categoryId) {
    redirect('/admin/categories?error=카테고리 ID가 없습니다.');
  }

  await prisma.category.update({
    where: { id: categoryId },
    data: { isActive: !isActive },
  });

  await logModerationAction(
    user.id,
    'CATEGORY',
    categoryId,
    isActive ? 'DEACTIVATE' : 'ACTIVATE',
  );

  revalidatePath('/admin/categories');
  redirect('/admin/categories');
}

export async function updateCategorySettingsAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const categoryId = normalizeText(formData.get('categoryId'));
  const type = normalizeText(formData.get('type')) as CategoryType;
  const visibilityMode = normalizeText(formData.get('visibilityMode')) as CategoryVisibilityMode;
  const colorValue = normalizeText(formData.get('color'));
  const requireCommentBeforeContactDefault =
    formData.get('requireCommentBeforeContactDefault') === 'on';
  const contactSectionDefaultExpanded = formData.get('contactSectionDefaultExpanded') === 'on';
  const quickCommentTemplates = normalizeQuickCommentTemplates(
    formData.get('quickCommentTemplates'),
  );
  const color = normalizeHexColor(colorValue);

  if (!categoryId) {
    redirect('/admin/categories?error=카테고리 ID가 없습니다.');
  }

  if (!VALID_CATEGORY_TYPES.includes(type)) {
    redirect('/admin/categories?error=유효하지 않은 카테고리 타입입니다.');
  }

  if (!VALID_CATEGORY_VISIBILITY_MODES.includes(visibilityMode)) {
    redirect('/admin/categories?error=유효하지 않은 카테고리 노출 방식입니다.');
  }

  if (colorValue && !color) {
    redirect('/admin/categories?error=카테고리 색상은 #RRGGBB 형식이어야 합니다.');
  }

  await prisma.category.update({
    where: { id: categoryId },
    data: {
      type,
      visibilityMode,
      color,
      requireCommentBeforeContactDefault,
      contactSectionDefaultExpanded,
      quickCommentTemplates:
        quickCommentTemplates.length > 0 ? quickCommentTemplates : Prisma.DbNull,
    },
  });

  await logModerationAction(user.id, 'CATEGORY', categoryId, 'SETTINGS_UPDATE');

  revalidatePath('/admin/categories');
  redirect('/admin/categories');
}

export async function reorderCategoriesAction(ids: string[]): Promise<void> {
  const user = await requireUser();
  requireAdmin(user);

  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return;
  }

  await Promise.all(
    ids.map((id, index) =>
      prisma.category.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  await logModerationAction(user.id, 'CATEGORY', ids.join(','), 'REORDER');

  revalidatePath('/admin/categories');
  revalidatePath('/posts');
  revalidatePath('/posts/new');
}

export async function createPostTagOptionAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const categoryType = normalizeText(formData.get('categoryType')) as CategoryType;
  const label = normalizeText(formData.get('label'));
  const slug = normalizeText(formData.get('slug')).toLowerCase();
  const sortOrderRaw = normalizeText(formData.get('sortOrder'));
  const sortOrder = sortOrderRaw ? Number.parseInt(sortOrderRaw, 10) : 0;

  if (!categoryType || !label || !slug) {
    redirect('/admin/categories?error=카테고리 타입, 태그명, 슬러그를 입력해 주세요.');
  }

  if (!VALID_CATEGORY_TYPES.includes(categoryType)) {
    redirect('/admin/categories?error=유효하지 않은 카테고리 타입입니다.');
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    redirect('/admin/categories?error=태그 슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.');
  }

  if (Number.isNaN(sortOrder)) {
    redirect('/admin/categories?error=정렬 순서는 숫자로 입력해 주세요.');
  }

  const existing = await prisma.postTagOption.findUnique({
    where: {
      categoryType_slug: {
        categoryType,
        slug,
      },
    },
    select: { id: true },
  });

  if (existing) {
    redirect('/admin/categories?error=동일한 슬러그 태그가 이미 존재합니다.');
  }

  const existingLabel = await prisma.postTagOption.findFirst({
    where: {
      categoryType,
      label,
    },
    select: { id: true },
  });

  if (existingLabel) {
    redirect('/admin/categories?error=동일한 이름 태그가 이미 존재합니다.');
  }

  await prisma.postTagOption.create({
    data: {
      categoryType,
      label,
      slug,
      sortOrder,
      isActive: true,
    },
  });

  await logModerationAction(user.id, 'POST_TAG_OPTION', categoryType, 'CREATE');

  revalidatePath('/admin/categories');
  revalidatePath('/posts');
  revalidatePath('/posts/new');
  redirect('/admin/categories');
}

export async function updatePostTagOptionAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const optionId = normalizeText(formData.get('optionId'));
  const label = normalizeText(formData.get('label'));
  const slug = normalizeText(formData.get('slug')).toLowerCase();
  const sortOrderRaw = normalizeText(formData.get('sortOrder'));
  const sortOrder = sortOrderRaw ? Number.parseInt(sortOrderRaw, 10) : 0;

  if (!optionId || !label || !slug) {
    redirect('/admin/categories?error=태그 정보가 올바르지 않습니다.');
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    redirect('/admin/categories?error=태그 슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.');
  }

  if (Number.isNaN(sortOrder)) {
    redirect('/admin/categories?error=정렬 순서는 숫자로 입력해 주세요.');
  }

  const option = await prisma.postTagOption.findUnique({
    where: { id: optionId },
    select: { id: true, categoryType: true, isActive: true },
  });

  if (!option) {
    redirect('/admin/categories?error=태그를 찾을 수 없습니다.');
  }

  const duplicate = await prisma.postTagOption.findFirst({
    where: {
      categoryType: option.categoryType,
      slug,
      NOT: { id: option.id },
    },
    select: { id: true },
  });

  if (duplicate) {
    redirect('/admin/categories?error=동일한 슬러그 태그가 이미 존재합니다.');
  }

  const duplicateLabel = await prisma.postTagOption.findFirst({
    where: {
      categoryType: option.categoryType,
      label,
      NOT: { id: option.id },
    },
    select: { id: true },
  });

  if (duplicateLabel) {
    redirect('/admin/categories?error=동일한 이름 태그가 이미 존재합니다.');
  }

  await prisma.postTagOption.update({
    where: { id: option.id },
    data: {
      label,
      slug,
      sortOrder,
    },
  });

  await logModerationAction(user.id, 'POST_TAG_OPTION', option.id, 'UPDATE');

  revalidatePath('/admin/categories');
  revalidatePath('/posts');
  revalidatePath('/posts/new');
  redirect('/admin/categories');
}

export async function togglePostTagOptionActiveAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const optionId = normalizeText(formData.get('optionId'));
  const isActive = formData.get('isActive') === 'true';

  if (!optionId) {
    redirect('/admin/categories?error=태그 ID가 없습니다.');
  }

  const option = await prisma.postTagOption.findUnique({
    where: { id: optionId },
    select: { id: true },
  });

  if (!option) {
    redirect('/admin/categories?error=태그를 찾을 수 없습니다.');
  }

  await prisma.postTagOption.update({
    where: { id: option.id },
    data: {
      isActive: !isActive,
    },
  });

  await logModerationAction(
    user.id,
    'POST_TAG_OPTION',
    option.id,
    isActive ? 'DEACTIVATE' : 'ACTIVATE',
  );

  revalidatePath('/admin/categories');
  revalidatePath('/posts');
  revalidatePath('/posts/new');
  redirect('/admin/categories');
}

export async function reorderPostTagOptionsAction(ids: string[]): Promise<void> {
  const user = await requireUser();
  requireAdmin(user);

  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return;
  }

  await Promise.all(
    ids.map((id, index) =>
      prisma.postTagOption.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  await logModerationAction(user.id, 'POST_TAG_OPTION', ids.join(','), 'REORDER');

  revalidatePath('/admin/categories');
  revalidatePath('/posts');
  revalidatePath('/posts/new');
}

export async function createPostPermissionAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const subjectType = normalizeText(formData.get('subjectType')) as PermissionSubjectType;
  const userId = normalizeText(formData.get('userId')) || null;
  const rawRole = normalizeText(formData.get('role'));
  const role = USER_ROLES.find((candidate) => candidate === rawRole) ?? null;
  const countryId = normalizeText(formData.get('countryId')) || null;
  const cityId = normalizeText(formData.get('cityId')) || null;
  const categoryId = normalizeText(formData.get('categoryId')) || null;
  const returnTo = normalizeAdminReturnTo(formData.get('returnTo'), '/admin/post-permissions');

  if (!Object.values(PermissionSubjectType).includes(subjectType)) {
    redirectWithQuery(returnTo, { error: '유효하지 않은 권한 주체입니다.' });
  }

  if (subjectType === 'USER' && !userId) {
    redirectWithQuery(returnTo, { error: '사용자를 선택해 주세요.' });
  }

  if (subjectType === 'ROLE' && !role) {
    redirectWithQuery(returnTo, { error: '유효하지 않은 역할입니다.' });
  }

  if (cityId && !countryId) {
    redirectWithQuery(returnTo, { error: '도시를 지정하려면 국가를 함께 선택해 주세요.' });
  }

  const [targetUser, country, city, category, existingPermission] = await Promise.all([
    userId
      ? prisma.user.findUnique({
          where: { id: userId },
          select: { id: true },
        })
      : Promise.resolve(null),
    countryId
      ? prisma.country.findFirst({
          where: { id: countryId, isActive: true },
          select: { id: true },
        })
      : Promise.resolve(null),
    cityId
      ? prisma.city.findFirst({
          where: { id: cityId, isActive: true },
          select: { id: true, countryId: true },
        })
      : Promise.resolve(null),
    categoryId
      ? prisma.category.findFirst({
          where: { id: categoryId, isActive: true },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.postPermission.findFirst({
      where: {
        subjectType,
        userId: subjectType === 'USER' ? userId : null,
        role: subjectType === 'ROLE' ? role : null,
        countryId,
        cityId,
        categoryId,
      },
      select: { id: true },
    }),
  ]);

  if (subjectType === 'USER' && !targetUser) {
    redirectWithQuery(returnTo, { error: '사용자를 찾을 수 없습니다.' });
  }

  if (countryId && !country) {
    redirectWithQuery(returnTo, { error: '국가를 찾을 수 없습니다.' });
  }

  if (cityId && (!city || city.countryId !== countryId)) {
    redirectWithQuery(returnTo, { error: '도시를 올바르게 선택해 주세요.' });
  }

  if (categoryId && !category) {
    redirectWithQuery(returnTo, { error: '카테고리를 찾을 수 없습니다.' });
  }

  if (existingPermission) {
    redirectWithQuery(returnTo, { error: '동일한 권한이 이미 존재합니다.' });
  }

  await prisma.postPermission.create({
    data: {
      subjectType,
      userId: subjectType === 'USER' ? userId : null,
      role: subjectType === 'ROLE' ? role : null,
      countryId,
      cityId,
      categoryId,
    },
  });

  await logModerationAction(user.id, 'POST_PERMISSION', userId ?? role ?? 'UNKNOWN', `CREATE_${subjectType}`);

  revalidatePath('/admin/post-permissions');
  revalidatePath('/posts/new');
  redirect(returnTo);
}

export async function deletePostPermissionAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const permissionId = normalizeText(formData.get('permissionId'));
  const returnTo = normalizeAdminReturnTo(formData.get('returnTo'), '/admin/post-permissions');

  if (!permissionId) {
    redirectWithQuery(returnTo, { error: '권한 ID가 없습니다.' });
  }

  const permission = await prisma.postPermission.findUnique({
    where: { id: permissionId },
    select: {
      id: true,
      subjectType: true,
      userId: true,
      role: true,
    },
  });

  if (!permission) {
    redirectWithQuery(returnTo, { error: '권한을 찾을 수 없습니다.' });
  }

  await prisma.postPermission.delete({
    where: { id: permissionId },
  });

  await logModerationAction(
    user.id,
    'POST_PERMISSION',
    permission.id,
    `DELETE_${permission.subjectType}_${permission.userId ?? permission.role ?? 'UNKNOWN'}`,
  );

  revalidatePath('/admin/post-permissions');
  revalidatePath('/posts/new');
  redirect(returnTo);
}

export async function createCityAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const name = normalizeText(formData.get('name'));
  const slug = normalizeText(formData.get('slug'));
  const countryId = normalizeText(formData.get('countryId')) || null;

  if (!name || !slug) {
    redirect('/admin/cities?error=이름과 슬러그를 입력해 주세요.');
  }

  const existing = await prisma.city.findUnique({ where: { slug } });
  if (existing) {
    redirect('/admin/cities?error=이미 존재하는 슬러그입니다.');
  }

  if (countryId) {
    const country = await prisma.country.findUnique({ where: { id: countryId }, select: { id: true } });
    if (!country) {
      redirect('/admin/cities?error=유효하지 않은 국가입니다.');
    }
  }

  await prisma.city.create({
    data: { name, slug, countryId },
  });

  revalidatePath('/admin/cities');
  redirect('/admin/cities');
}

export async function toggleCityActiveAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const cityId = normalizeText(formData.get('cityId'));
  const isActive = formData.get('isActive') === 'true';

  if (!cityId) {
    redirect('/admin/cities?error=도시 ID가 없습니다.');
  }

  await prisma.city.update({
    where: { id: cityId },
    data: { isActive: !isActive },
  });

  await logModerationAction(
    user.id,
    'CITY',
    cityId,
    isActive ? 'DEACTIVATE' : 'ACTIVATE',
  );

  revalidatePath('/admin/cities');
  redirect('/admin/cities');
}

export async function createReportOptionAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const label = normalizeText(formData.get('label'));
  const returnTo = normalizeAdminReturnTo(formData.get('returnTo'), '/admin/report-options');

  if (!label) {
    redirectWithQuery(returnTo, { error: '신고 옵션 이름을 입력해 주세요.' });
  }

  const exists = await prisma.reportOption.findFirst({
    where: { label },
    select: { id: true },
  });

  if (exists) {
    redirectWithQuery(returnTo, { error: '이미 존재하는 신고 옵션입니다.' });
  }

  const sortOrder = await prisma.reportOption.count();
  const option = await prisma.reportOption.create({
    data: {
      label,
      isActive: true,
      sortOrder,
    },
    select: { id: true },
  });

  await logModerationAction(user.id, 'REPORT_OPTION', option.id, 'CREATE', label);

  revalidatePath('/admin/report-options');
  redirect(returnTo);
}

export async function toggleReportOptionActiveAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const optionId = normalizeText(formData.get('optionId'));
  const isActive = formData.get('isActive') === 'true';
  const returnTo = normalizeAdminReturnTo(formData.get('returnTo'), '/admin/report-options');

  if (!optionId) {
    redirectWithQuery(returnTo, { error: '신고 옵션 ID가 없습니다.' });
  }

  await prisma.reportOption.update({
    where: { id: optionId },
    data: { isActive: !isActive },
  });

  await logModerationAction(
    user.id,
    'REPORT_OPTION',
    optionId,
    isActive ? 'DEACTIVATE' : 'ACTIVATE',
  );

  revalidatePath('/admin/report-options');
  redirect(returnTo);
}

export async function createCountryAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const name = normalizeText(formData.get('name'));
  const slug = normalizeText(formData.get('slug'));

  if (!name || !slug) {
    redirect('/admin/cities?error=이름과 슬러그를 입력해 주세요.');
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    redirect('/admin/cities?error=슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.');
  }

  const existing = await prisma.country.findUnique({ where: { slug } });
  if (existing) {
    redirect('/admin/cities?error=이미 존재하는 슬러그입니다.');
  }

  const sortOrder = await prisma.country.count();
  const country = await prisma.country.create({
    data: { name, slug, sortOrder },
    select: { id: true },
  });

  await logModerationAction(user.id, 'COUNTRY', country.id, 'CREATE', name);

  revalidatePath('/admin/cities');
  redirect('/admin/cities');
}

export async function toggleCountryActiveAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const countryId = normalizeText(formData.get('countryId'));
  const isActive = formData.get('isActive') === 'true';

  if (!countryId) {
    redirect('/admin/cities?error=국가 ID가 없습니다.');
  }

  await prisma.country.update({
    where: { id: countryId },
    data: { isActive: !isActive },
  });

  await logModerationAction(
    user.id,
    'COUNTRY',
    countryId,
    isActive ? 'DEACTIVATE' : 'ACTIVATE',
  );

  revalidatePath('/admin/cities');
  redirect('/admin/cities');
}

export async function assignCityCountryAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const cityId = normalizeText(formData.get('cityId'));
  const countryId = normalizeText(formData.get('countryId')) || null;

  if (!cityId) {
    redirect('/admin/cities?error=도시 ID가 없습니다.');
  }

  if (countryId) {
    const country = await prisma.country.findUnique({ where: { id: countryId }, select: { id: true } });
    if (!country) {
      redirect('/admin/cities?error=유효하지 않은 국가입니다.');
    }
  }

  await prisma.city.update({
    where: { id: cityId },
    data: { countryId },
  });

  await logModerationAction(user.id, 'CITY', cityId, 'ASSIGN_COUNTRY', countryId ?? 'none');

  revalidatePath('/admin/cities');
  redirect('/admin/cities');
}

export async function updateReputationSettingsAction(formData: FormData) {
  const user = await requireUser();
  requireAdmin(user);

  const updates: Array<{ key: ReputationSettingKey; value: string }> = [];

  for (const field of REPUTATION_SETTING_FIELDS) {
    const raw = normalizeText(formData.get(field.key));
    if (!raw) {
      redirectWithQuery('/admin/reputation-settings', {
        error: '모든 설정 값을 입력해 주세요.',
      });
    }

    const value = Number(raw);
    if (!Number.isFinite(value)) {
      redirectWithQuery('/admin/reputation-settings', {
        error: '모든 설정 값은 숫자여야 합니다.',
      });
    }

    updates.push({ key: field.key, value: String(value) });
  }

  const minWarmth = Number(
    updates.find((item) => item.key === 'NEIGHBOUR_WARMTH_MIN_WARMTH')?.value ??
      REPUTATION_SETTING_DEFAULTS.NEIGHBOUR_WARMTH_MIN_WARMTH,
  );
  const baseWarmth = Number(
    updates.find((item) => item.key === 'NEIGHBOUR_WARMTH_BASE_WARMTH')?.value ??
      REPUTATION_SETTING_DEFAULTS.NEIGHBOUR_WARMTH_BASE_WARMTH,
  );
  const maxWarmth = Number(
    updates.find((item) => item.key === 'NEIGHBOUR_WARMTH_MAX_WARMTH')?.value ??
      REPUTATION_SETTING_DEFAULTS.NEIGHBOUR_WARMTH_MAX_WARMTH,
  );

  if (!(minWarmth <= baseWarmth && baseWarmth <= maxWarmth)) {
    redirectWithQuery('/admin/reputation-settings', {
      error: 'minWarmth ≤ baseWarmth ≤ maxWarmth 이어야 합니다.',
    });
  }

  await prisma.$transaction(
    updates.map((item) =>
      prisma.appSetting.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: { key: item.key, value: item.value },
      }),
    ),
  );

  await logModerationAction(user.id, 'APP_SETTING', 'REPUTATION', 'UPDATE_REPUTATION_SETTINGS');

  revalidatePath('/admin/reputation-settings');
  redirectWithQuery('/admin/reputation-settings', {
    success: '설정을 저장했어요.',
  });
}
