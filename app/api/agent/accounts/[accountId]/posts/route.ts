import { NextRequest } from 'next/server';

import { requireAgent } from '@/lib/agent/auth';
import { agentError, agentJson } from '@/lib/agent/http';
import { getAgentAccountPosts } from '@/lib/agent/service';

export async function GET(request: NextRequest, context: { params: Promise<{ accountId: string }> }) {
  try {
    requireAgent(request, ['agent.posts.read']);
    const { accountId } = await context.params;
    const rawLimit = Number(request.nextUrl.searchParams.get('limit') ?? '20');
    const limit = Number.isFinite(rawLimit) ? rawLimit : 20;
    return agentJson(await getAgentAccountPosts(accountId, limit));
  } catch (error) {
    return agentError(error);
  }
}
