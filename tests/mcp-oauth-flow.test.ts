import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const nodeRequire = createRequire(import.meta.url);

function loadModule(path, dependencies) {
  const source = readFileSync(path, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, {
    module, exports: module.exports,
    require(id) {
      if (id === 'node:crypto') return nodeRequire(id);
      if (id in dependencies) return dependencies[id];
      throw new Error('Unexpected mocked dependency: ' + id);
    },
    Buffer, Date, URL, URLSearchParams, Request, Response,
    process: { env: { NEXT_PUBLIC_SITE_URL: 'https://kormmunity.com', NODE_ENV: 'test' } },
  }, { filename: path });
  return module.exports;
}

function setup() {
  let failTokenCreate = false;
  let nextId = 0;
  const rows = [];
  const codes = [];
  const clientId = 'chatgpt-client';
  const resource = 'https://kormmunity.com/api/mcp';
  const tokenStore = {
    async create({ data }) {
      if (failTokenCreate) throw new Error('simulated DB write failure');
      const row = { id: 't' + ++nextId, revokedAt: null, ...data };
      rows.push(row);
      return row;
    },
    async findUnique({ where }) {
      return rows.find((row) =>
        (where.refreshHash !== undefined && row.refreshHash === where.refreshHash) ||
        (where.accessHash !== undefined && row.accessHash === where.accessHash)) ?? null;
    },
    async updateMany({ where, data }) {
      let count = 0;
      for (const row of rows) {
        if (where.id && where.id !== row.id) continue;
        if (where.refreshHash && where.refreshHash !== row.refreshHash) continue;
        if (where.revokedAt === null && row.revokedAt !== null) continue;
        if (where.refreshExpiresAt?.gt && !(row.refreshExpiresAt > where.refreshExpiresAt.gt)) continue;
        if (where.clientId && where.clientId !== row.clientId) continue;
        if (where.OR && !where.OR.some((part) =>
          part.accessHash === row.accessHash || (row.refreshHash && part.refreshHash === row.refreshHash))) continue;
        Object.assign(row, data);
        count++;
      }
      return { count };
    },
  };
  const prisma = {
    mcpOAuthClient: { async findUnique({ where }) {
      return where.id === clientId ? { id: clientId, name: 'ChatGPT', redirectUris: ['https://chatgpt.com/callback'] } : null;
    } },
    user: { async findFirst({ where }) {
      return where.id === 'admin' ? { id: 'admin', displayName: 'Admin' } : null;
    } },
    mcpOAuthCode: {
      async create({ data }) { const row = { id: 'c' + codes.length, consumedAt: null, ...data }; codes.push(row); return row; },
      async findUnique({ where }) { return codes.find((row) => row.codeHash === where.codeHash) ?? null; },
      async updateMany({ where, data }) {
        const row = codes.find((candidate) => candidate.id === where.id && !candidate.consumedAt &&
          candidate.expiresAt > where.expiresAt?.gt);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    mcpOAuthToken: tokenStore,
    async $transaction(callback) {
      const snapshot = rows.map((row) => ({ ...row }));
      try { return await callback({ mcpOAuthToken: tokenStore }); }
      catch (error) { rows.splice(0, rows.length, ...snapshot); throw error; }
    },
  };
  const oauth = loadModule('lib/mcp/oauth.ts', { '@/lib/db/prisma': { prisma } });
  const client = {
    resource, clientId,
    async issue(scopes = 'mcp:tools') {
      const verifier = 'a'.repeat(43);
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      const redirectUri = 'https://chatgpt.com/callback';
      const redirect = await oauth.approveMcpAuthorization('admin', {
        clientId, redirectUri, state: 'client-state-abc', challenge,
        scope: scopes, resource, clientName: 'ChatGPT',
      });
      const code = new URL(redirect).searchParams.get('code');
      return oauth.exchangeMcpToken(new URLSearchParams({
        grant_type: 'authorization_code', client_id: clientId, code,
        redirect_uri: redirectUri, code_verifier: verifier, resource,
      }));
    },
    refresh(refreshToken) {
      return oauth.exchangeMcpToken(new URLSearchParams({
        grant_type: 'refresh_token', client_id: clientId,
        refresh_token: refreshToken, resource,
      }));
    },
  };
  return { oauth, rows, client, failNextCreate(flag) { failTokenCreate = flag; } };
}

test('mcp:tools-only OAuth exchange issues a usable 30-day refresh token', async () => {
  const { client, oauth, rows } = setup();
  const first = await client.issue();
  assert.equal(first.scope, 'mcp:tools');
  assert.equal(first.expires_in, 3600);
  assert.ok(first.refresh_token, 'Refresh must not depend on the optional offline_access scope');
  assert.equal((rows[0].refreshExpiresAt - rows[0].expiresAt) / 1000, 30 * 86400 - 3600);
  assert.equal((await oauth.requireMcpAccess('Bearer ' + first.access_token)).id, 'admin');
  const second = await client.refresh(first.refresh_token);
  assert.ok(second.refresh_token);
  assert.notEqual(second.refresh_token, first.refresh_token);
  assert.notEqual(second.access_token, first.access_token);
  assert.equal((await oauth.requireMcpAccess('Bearer ' + second.access_token)).id, 'admin');
  // Rotation must not abort requests already using a still-valid access token.
  assert.equal((await oauth.requireMcpAccess('Bearer ' + first.access_token)).id, 'admin');
  await assert.rejects(client.refresh(first.refresh_token), (error) => error.code === 'invalid_grant');
  assert.ok((await client.refresh(second.refresh_token)).refresh_token);
});

test('refresh rotation is atomic when writing replacement credentials fails', async () => {
  const { client, rows, failNextCreate } = setup();
  const first = await client.issue('mcp:tools offline_access');
  failNextCreate(true);
  await assert.rejects(client.refresh(first.refresh_token), /simulated DB write failure/);
  assert.ok(rows[0].refreshHash, 'Rollback must restore the original usable refresh hash');
  failNextCreate(false);
  const retried = await client.refresh(first.refresh_token);
  assert.ok(retried.refresh_token);
  assert.equal(rows[0].refreshHash, null);
});

test('invalid or expired Bearer tokens produce 401 with WWW-Authenticate; no token gets linking metadata', async () => {
  const { oauth } = setup();
  const route = loadModule('app/api/mcp/route.ts', {
    '@/lib/agent/http': { AgentApiError: class AgentApiError extends Error {} },
    '@/lib/mcp/oauth': { ...oauth },
    '@/lib/mcp/tools': { mcpTools: [{ name: 'kormmunity_me' }], callMcpTool: async () => ({ ok: true }) },
  });
  const body = JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/call',
    params: { name: 'kormmunity_me', arguments: {} } });
  const expired = await route.POST(new Request('https://kormmunity.com/api/mcp', {
    method: 'POST', headers: { Authorization: 'Bearer expired' }, body,
  }));
  assert.equal(expired.status, 401);
  assert.match(expired.headers.get('www-authenticate'), /error="invalid_token"/);
  assert.match(expired.headers.get('www-authenticate'), /scope="mcp:tools"/);
  const fresh = await route.POST(new Request('https://kormmunity.com/api/mcp', {
    method: 'POST', body,
  }));
  assert.equal(fresh.status, 200);
  const response = await fresh.json();
  assert.ok(response.result._meta['mcp/www_authenticate']);
});
