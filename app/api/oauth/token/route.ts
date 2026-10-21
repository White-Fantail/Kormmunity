import { exchangeMcpToken, McpOAuthError } from '@/lib/mcp/oauth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const form = new URLSearchParams(await request.text());
    const token = await exchangeMcpToken(form);
    return Response.json(token, { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } });
  } catch (error) {
    const e = error instanceof McpOAuthError ? error :
      new McpOAuthError('server_error', 'Token exchange failed.', 500);
    return Response.json({ error: e.code, error_description: e.message },
      { status: e.status, headers: { 'Cache-Control': 'no-store' } });
  }
}
