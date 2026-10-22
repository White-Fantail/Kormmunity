import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync('app/api/mcp/route.ts', 'utf8');
const tools = readFileSync('lib/mcp/tools.ts', 'utf8');
const oauth = readFileSync('lib/mcp/oauth.ts', 'utf8');
const protectedResource = readFileSync('app/.well-known/oauth-protected-resource/route.ts', 'utf8');
const authServer = readFileSync('app/.well-known/oauth-authorization-server/route.ts', 'utf8');

test('MCP tool discovery does not require an OAuth access token', () => {
  const list = route.indexOf("if (rpc.method === 'tools/list')");
  const authenticate = route.indexOf('actor = await authorize(request)');
  assert.ok(list >= 0, 'Expected a tools/list handler');
  assert.ok(authenticate > list, 'Authentication must occur only during tools/call');
  assert.ok(route.includes("if (!isAllowedOrigin(request.headers.get('origin')))"),
    'Public discovery must still enforce the trusted Origin restriction');
});

test('each declared Kormmunity tool requests OAuth before invocation', () => {
  const declaredTools = tools.match(/name: 'kormmunity_[a-z_]+'/g) || [];
  const protectedTools = tools.match(/securitySchemes: requiresAdminOAuth, inputSchema:/g) || [];
  assert.equal(declaredTools.length, 8, 'The eight advertised tools must stay discoverable');
  assert.equal(protectedTools.length, declaredTools.length,
    'Every advertised tool must declare the required admin OAuth scope');
  assert.match(tools, /scopes: \['mcp:tools'\]/);
});

test('authorization metadata advertises offline access, but MCP resources only require tool access', () => {
  assert.match(authServer, /grant_types_supported: \['authorization_code', 'refresh_token'\]/);
  assert.match(authServer, /scopes_supported: \['mcp:tools', 'offline_access'\]/);
  assert.match(protectedResource, /scopes_supported: \['mcp:tools'\]/);
  assert.match(route, /scope="mcp:tools"/);
  assert.doesNotMatch(route, /scope="mcp:tools offline_access"/);
});

test('approved MCP connections issue a rotating refresh token even without offline_access in scope', () => {
  assert.match(oauth, /const refreshToken = secret\(\);/);
  assert.match(oauth, /refresh_token: refreshToken/);
  assert.doesNotMatch(oauth, /scope\.split\(' '\)\.includes\(REFRESH_SCOPE\) \? secret\(\) : null/);
  assert.match(oauth, /await prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(oauth, /data: \{ refreshHash: null \}/);
  assert.match(oauth, /await tx\.mcpOAuthToken\.create\(\{ data: issued\.data \}\)/);
});

test('unauthenticated tools offer linking but expired Bearer tokens receive HTTP 401 for refresh', () => {
  assert.ok(route.includes("'mcp/www_authenticate'"),
    'First invocation still needs the ChatGPT linking challenge');
  assert.match(route, /if \(request\.headers\.get\('authorization'\)\) return unauthorized\(error\)/);
  assert.ok(route.includes('error="invalid_token"'));
  assert.ok(route.includes("'WWW-Authenticate'"));
});
