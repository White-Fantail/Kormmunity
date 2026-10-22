import { mcpOrigin, mcpResource } from '@/lib/mcp/oauth';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({
    resource: mcpResource(),
    authorization_servers: [mcpOrigin()],
    scopes_supported: ['mcp:tools'],
    bearer_methods_supported: ['header'],
  }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
