import { McpOAuthError, registerMcpClient } from '@/lib/mcp/oauth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 8192) {
      throw new McpOAuthError('invalid_client_metadata', 'Client metadata too large.');
    }
    const client = await registerMcpClient(await request.json());
    return Response.json(client, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const e = error instanceof McpOAuthError ? error :
      new McpOAuthError('invalid_client_metadata', 'Invalid client registration payload.');
    return Response.json({ error: e.code, error_description: e.message }, { status: e.status });
  }
}
