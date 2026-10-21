import { revokeMcpToken } from '@/lib/mcp/oauth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  await revokeMcpToken(new URLSearchParams(await request.text()));
  return new Response(null, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
