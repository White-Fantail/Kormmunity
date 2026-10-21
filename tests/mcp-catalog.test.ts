import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync('app/api/mcp/route.ts', 'utf8');
const tools = readFileSync('lib/mcp/tools.ts', 'utf8');

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

test('unauthenticated tool calls return a ChatGPT OAuth linking challenge', () => {
  assert.ok(route.includes("'mcp/www_authenticate'"),
    'Tool-level OAuth UI depends on mcp/www_authenticate metadata');
  assert.ok(route.includes('error="invalid_token"'));
  assert.ok(route.includes('error_description='));
});
