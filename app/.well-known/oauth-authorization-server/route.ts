import { mcpOrigin } from '@/lib/mcp/oauth';

export const dynamic = 'force-dynamic';

export function GET() {
  const origin = mcpOrigin();
  return Response.json({
    issuer: origin,
    // RFC 9207: both successful and denied redirects include the exact issuer.
    // ChatGPT can consequently use /connector_platform_oauth_redirect.
    authorization_response_iss_parameter_supported: true,
    authorization_endpoint: origin + '/api/oauth/authorize',
    token_endpoint: origin + '/api/oauth/token',
    registration_endpoint: origin + '/api/oauth/register',
    revocation_endpoint: origin + '/api/oauth/revoke',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['mcp:tools', 'offline_access'],
    client_id_metadata_document_supported: false,
  }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
