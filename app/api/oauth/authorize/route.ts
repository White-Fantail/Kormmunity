import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { McpOAuthError, approveMcpAuthorization, denyMcpAuthorization,
  parseAuthorizeParams } from '@/lib/mcp/oauth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/mcp/consent?' +
    request.nextUrl.searchParams.toString(), request.url));
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new McpOAuthError('login_required', 'Sign in again to approve MCP.', 401);
    const params = await parseAuthorizeParams(request.nextUrl.searchParams);
    const body = await request.formData();
    const destination = body.get('decision') === 'approve'
      ? await approveMcpAuthorization(user.id, params)
      : denyMcpAuthorization(params);
    return NextResponse.redirect(destination, { status: 303 });
  } catch (error) {
    const e = error instanceof McpOAuthError ? error :
      new McpOAuthError('server_error', 'Unable to authorize MCP.', 500);
    return NextResponse.json({ error: e.code, error_description: e.message },
      { status: e.status, headers: { 'Cache-Control': 'no-store' } });
  }
}
