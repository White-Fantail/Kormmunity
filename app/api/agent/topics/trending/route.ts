import { NextRequest } from 'next/server';

import { requireAgent } from '@/lib/agent/auth';
import { agentError, agentJson } from '@/lib/agent/http';
import { getTrendingTopics } from '@/lib/agent/service';

export async function GET(request: NextRequest) {
  try {
    requireAgent(request, ['agent.metadata.read']);
    const rawLimit = Number(request.nextUrl.searchParams.get('limit') ?? '20');
    const limit = Number.isFinite(rawLimit) ? rawLimit : 20;
    return agentJson(await getTrendingTopics(limit));
  } catch (error) {
    return agentError(error);
  }
}
