import { AgentApiError } from '@/lib/agent/http';
import { prisma } from '@/lib/db/prisma';

export async function assertAgentOwnsPost(agentKeyId: string, postId: string) {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS(
      SELECT 1
      FROM "AgentRequest"
      WHERE "agentKeyId" = ${agentKeyId}
        AND "operation" = 'posts.create'
        AND "postId" = ${postId}
    ) AS "exists"
  `;

  if (!rows[0]?.exists) {
    throw new AgentApiError('Post is not owned by this Agent API key.', 403, 'post_not_owned');
  }
}
