'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { isAdmin } from '@/lib/permissions';

export async function revokeMcpClientAction(form: FormData) {
  const actor = await getCurrentUser();
  if (!actor || !isAdmin(actor) || actor.isActive === false || actor.status !== 'ACTIVE') {
    throw new Error('Administrator approval required.');
  }
  const clientId = form.get('clientId');
  if (typeof clientId !== 'string' || !clientId) {
    throw new Error('Missing client ID.');
  }
  await prisma.mcpOAuthToken.updateMany({
    where: { userId: actor.id, clientId, revokedAt: null },
    data: { revokedAt: new Date(), refreshHash: null },
  });
  revalidatePath('/admin/mcp');
}
