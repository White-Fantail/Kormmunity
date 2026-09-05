import { NextRequest } from 'next/server';

import { assertAgentOwnsPost } from '@/lib/agent/access';
import { requireAgent } from '@/lib/agent/auth';
import { agentError, agentJson, readJsonObject } from '@/lib/agent/http';
import { getAgentPost, updateAgentPost } from '@/lib/agent/service';

export async function GET(request: NextRequest, context: { params: Promise<{ postId: string }> }) {
  try {
    const principal = requireAgent(request, ['agent.posts.read']);
    const { postId } = await context.params;
    await assertAgentOwnsPost(principal.keyId, postId);
    return agentJson(await getAgentPost(postId));
  } catch (error) {
    return agentError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ postId: string }> }) {
  try {
    const principal = requireAgent(request, ['agent.posts.write']);
    const { postId } = await context.params;
    await assertAgentOwnsPost(principal.keyId, postId);
    return agentJson(await updateAgentPost(postId, await readJsonObject(request)));
  } catch (error) {
    return agentError(error);
  }
}
