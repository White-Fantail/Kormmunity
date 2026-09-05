import { createHash, randomUUID } from 'node:crypto';

import type { AgentPrincipal } from '@/lib/agent/auth';
import { AgentApiError } from '@/lib/agent/http';
import { getAgentAccount } from '@/lib/agent/service';
import { prisma } from '@/lib/db/prisma';

type AgentRequestRow = {
  requestHash: string;
  response: unknown;
};

function stableHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function requiredString(body: Record<string, unknown>, field: string) {
  const value = body[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new AgentApiError(`${field} is required.`, 400, 'validation_error');
  }
  return value.trim();
}

function optionalString(body: Record<string, unknown>, field: string) {
  const value = body[field];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new AgentApiError(`${field} must be a string.`, 400, 'validation_error');
  }
  return value.trim() || null;
}

export async function createAgentComment(
  principal: AgentPrincipal,
  postId: string,
  idempotencyKey: string,
  body: Record<string, unknown>,
) {
  const authorAccountId = requiredString(body, 'authorAccountId');
  const commentBody = requiredString(body, 'body');
  const parentCommentId = optionalString(body, 'parentCommentId');

  if (commentBody.length > 500) {
    throw new AgentApiError('Comment body must be 500 characters or fewer.', 400, 'validation_error');
  }

  const account = await getAgentAccount(authorAccountId);
  if (!account.enabled) {
    throw new AgentApiError('Managed account is not enabled.', 403, 'account_disabled');
  }
  if (!account.automation.allowComments) {
    throw new AgentApiError('Comment automation is disabled for this account.', 403, 'automation_disabled');
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true, countryId: true, cityId: true },
  });
  if (!post || post.status !== 'PUBLISHED') {
    throw new AgentApiError('Post is not available for comments.', 404, 'post_not_found');
  }

  if (account.region?.type === 'city' && account.region.id !== `city:${post.cityId ?? ''}`) {
    throw new AgentApiError('Account region does not match the post region.', 403, 'region_not_allowed');
  }
  if (
    account.region?.type === 'country' &&
    account.region.id !== `country:${post.countryId ?? ''}`
  ) {
    throw new AgentApiError('Account region does not match the post region.', 403, 'region_not_allowed');
  }

  if (parentCommentId) {
    const parent = await prisma.comment.findFirst({
      where: { id: parentCommentId, postId, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!parent) {
      throw new AgentApiError('parentCommentId is not a published comment on this post.', 400, 'invalid_parent_comment');
    }
  }

  const hash = stableHash({ postId, authorAccountId, body: commentBody, parentCommentId });

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${principal.keyId}:comments.create:${idempotencyKey}`}))`;

    const existing = await tx.$queryRaw<AgentRequestRow[]>`
      SELECT "requestHash", "response"
      FROM "AgentRequest"
      WHERE "agentKeyId" = ${principal.keyId}
        AND "operation" = 'comments.create'
        AND "idempotencyKey" = ${idempotencyKey}
      LIMIT 1
    `;
    if (existing[0]) {
      if (existing[0].requestHash !== hash) {
        throw new AgentApiError('Idempotency-Key was reused with different content.', 409, 'idempotency_conflict');
      }
      return { replayed: true, comment: existing[0].response };
    }

    const comment = await tx.comment.create({
      data: {
        postId,
        authorId: authorAccountId,
        createdByUserId: null,
        body: commentBody,
        status: 'PUBLISHED',
      },
      select: { id: true, postId: true, authorId: true, body: true, status: true, createdAt: true },
    });

    if (parentCommentId) {
      await tx.$executeRaw`
        UPDATE "Comment"
        SET "parentCommentId" = ${parentCommentId}
        WHERE "id" = ${comment.id}
      `;
    }

    const response = {
      id: comment.id,
      postId: comment.postId,
      authorAccountId: comment.authorId,
      body: comment.body,
      parentCommentId,
      status: comment.status.toLowerCase(),
      createdAt: comment.createdAt.toISOString(),
    };

    await tx.$executeRaw`
      INSERT INTO "AgentRequest" (
        "id", "agentKeyId", "operation", "idempotencyKey", "requestHash",
        "postId", "commentId", "response"
      ) VALUES (
        ${randomUUID()}, ${principal.keyId}, 'comments.create', ${idempotencyKey}, ${hash},
        ${postId}, ${comment.id}, ${JSON.stringify(response)}::jsonb
      )
    `;

    return { replayed: false, comment: response };
  });
}
