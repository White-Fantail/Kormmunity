import { NextRequest } from 'next/server';

import { requireAgent } from '@/lib/agent/auth';
import { agentError, agentJson } from '@/lib/agent/http';
import { getAgentCategories } from '@/lib/agent/service';

export async function GET(request: NextRequest) {
  try {
    requireAgent(request, ['agent.metadata.read']);
    return agentJson(await getAgentCategories());
  } catch (error) {
    return agentError(error);
  }
}
