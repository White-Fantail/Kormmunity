import { NextRequest } from 'next/server';

import { requireAgent } from '@/lib/agent/auth';
import { createAgentComment } from '@/lib/agent/comments';
import { AgentApiError, agentError, agentJson, readJsonObject } from '@/lib/agent/http';

export async function POST(request: NextRequest, context: { params: Promise<{ postId: string }> }) {
  try {
    const principal = requireAgent(request, ['agent.posts.write']);
    const idempotencyKey = request.headers.get('idempotency-key')?.trim();
    if (!idempotencyKey) {
      throw new AgentApiError('Idempotency-Key header is required.', 400, 'idempotency_key_required');
    }
    if (idempotencyKey.length > 200) {
      throw new AgentApiError('Idempotency-Key is too long.', 400, 'invalid_idempotency_key');
    }

    const { postId } = await context.params;
    const result = await createAgentComment(
      principal,
      postId,
      idempotencyKey,
      await readJsonObject(request),
    );

    return agentJson(result.comment, {
      status: result.replayed ? 200 : 201,
      headers: { 'Idempotency-Replayed': result.replayed ? 'true' : 'false' },
    });
  } catch (error) {
    return agentError(error);
  }
}
