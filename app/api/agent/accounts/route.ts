import { NextRequest } from 'next/server';

import { requireAgent } from '@/lib/agent/auth';
import { agentError, agentJson } from '@/lib/agent/http';
import { getAgentAccounts } from '@/lib/agent/service';

export async function GET(request: NextRequest) {
  try {
    requireAgent(request, ['agent.accounts.read']);
    return agentJson(await getAgentAccounts());
  } catch (error) {
    return agentError(error);
  }
}
