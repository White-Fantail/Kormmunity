import { NextRequest } from 'next/server';

import { requireAgent } from '@/lib/agent/auth';
import { agentError, agentJson } from '@/lib/agent/http';
import { getAgentAccount } from '@/lib/agent/service';

export async function GET(request: NextRequest, context: { params: Promise<{ accountId: string }> }) {
  try {
    requireAgent(request, ['agent.accounts.read']);
    const { accountId } = await context.params;
    return agentJson(await getAgentAccount(accountId));
  } catch (error) {
    return agentError(error);
  }
}
