import { NextRequest } from 'next/server';

import { assertAgentOwnsPost } from '@/lib/agent/access';
import { requireAgent } from '@/lib/agent/auth';
import { agentError, agentJson } from '@/lib/agent/http';
import { publishAgentPost } from '@/lib/agent/service';

export async function POST(request: NextRequest, context: { params: Promise<{ postId: string }> }) {
  try {
    const principal = requireAgent(request, ['agent.posts.publish']);
    const { postId } = await context.params;
    await assertAgentOwnsPost(principal.keyId, postId);
    return agentJson(await publishAgentPost(postId));
  } catch (error) {
    return agentError(error);
  }
}
