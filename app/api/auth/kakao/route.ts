import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomBytes } from 'node:crypto';

import { getKakaoAuthUrl } from '@/lib/kakao/oauth';
import { MCP_LOGIN_NEXT_COOKIE, safeMcpLoginNext } from '@/lib/mcp/post-login';

const STATE_COOKIE = 'kakao_oauth_state';
const STATE_MAX_AGE_SECONDS = 60 * 10; // 10 minutes

export async function GET(request: Request) {
  const clientId = process.env.KAKAO_CLIENT_ID;
  const redirectUri = process.env.KAKAO_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    redirect('/login?error=config');
  }

  const state = randomBytes(16).toString('hex');
  const authUrl = getKakaoAuthUrl(state);

  const cookieStore = await cookies();
  const next = safeMcpLoginNext(new URL(request.url).searchParams.get('next'));
  if (next) cookieStore.set(MCP_LOGIN_NEXT_COOKIE, next, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STATE_MAX_AGE_SECONDS,
  });
  else cookieStore.delete(MCP_LOGIN_NEXT_COOKIE);

  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STATE_MAX_AGE_SECONDS,
  });

  redirect(authUrl);
}
