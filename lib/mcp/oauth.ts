import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { prisma } from '@/lib/db/prisma';

export const MCP_SCOPE = 'mcp:tools';
const REFRESH_SCOPE = 'offline_access';
const ACCESS_SECONDS = 60 * 60;
const REFRESH_SECONDS = 60 * 60 * 24 * 30;
const CODE_SECONDS = 5 * 60;

export class McpOAuthError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) {
    super(message);
  }
}

export function mcpOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL;
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new McpOAuthError('server_error', 'Configure NEXT_PUBLIC_SITE_URL to use MCP.', 503);
  }
  const url = new URL(configured || 'http://localhost:3000');
  // www is no longer the canonical OAuth issuer. Normalize stale deployment
  // environment values to prevent resource/audience mismatch after redirects.
  if (url.hostname.toLowerCase() === 'www.kormmunity.com') return 'https://kormmunity.com';
  return url.origin;
}

export function mcpResource() {
  return mcpOrigin() + '/api/mcp';
}

function digest(secret: string) {
  return createHash('sha256').update(secret).digest('hex');
}

function secret() {
  return randomBytes(32).toString('base64url');
}

function invalidClient() {
  throw new McpOAuthError('invalid_client', 'Unknown OAuth client.', 401);
}

function isPermittedRedirect(uri: string) {
  try {
    const url = new URL(uri);
    if (url.username || url.password || url.hash) return false;
    if (url.protocol === 'http:') {
      return (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
        process.env.NODE_ENV !== 'production';
    }
    if (url.protocol !== 'https:') return false;
    const hostname = url.hostname.toLowerCase();
    // Public DCR is limited to named, trusted MCP clients. Additional clients
    // can be explicitly enabled with MCP_ALLOWED_CLIENT_HOSTS.
    const allowed = ['chatgpt.com', 'chat.openai.com', 'openai.com', 'claude.ai',
      ...(process.env.MCP_ALLOWED_CLIENT_HOSTS || '').split(',').map((h) => h.trim()).filter(Boolean)];
    return allowed.some((host) => hostname === host || hostname.endsWith('.' + host));
  } catch {
    return false;
  }
}

export async function registerMcpClient(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new McpOAuthError('invalid_client_metadata', 'Expected client metadata object.');
  }
  const body = raw as Record<string, unknown>;
  const redirectUris = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length < 1 || redirectUris.length > 5 ||
      redirectUris.some((value) => typeof value !== 'string' || value.length > 1024 ||
        !isPermittedRedirect(value))) {
    throw new McpOAuthError('invalid_redirect_uri', 'Untrusted redirect URI.');
  }
  const grantTypes = body.grant_types;
  if (grantTypes !== undefined && (!Array.isArray(grantTypes) ||
      grantTypes.some((x) => x !== 'authorization_code' && x !== 'refresh_token'))) {
    throw new McpOAuthError('invalid_client_metadata', 'Unsupported grant type.');
  }
  const name = typeof body.client_name === 'string' ?
    body.client_name.trim().slice(0, 100) : 'External MCP client';
  const client = await prisma.mcpOAuthClient.create({
    data: { id: secret(), name, redirectUris },
  });
  return {
    client_id: client.id,
    client_name: client.name,
    redirect_uris: redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };
}

export type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
  scope: string;
  resource: string;
  clientName: string;
};

export async function parseAuthorizeParams(params: URLSearchParams): Promise<AuthorizeParams> {
  const clientId = params.get('client_id') || '';
  const redirectUri = params.get('redirect_uri') || '';
  const challenge = params.get('code_challenge') || '';
  const state = params.get('state') || '';
  const resource = params.get('resource') || mcpResource();
  const scope = params.get('scope') || MCP_SCOPE;
  const requestedScopes = scope.split(/\s+/).filter(Boolean);

  const client = await prisma.mcpOAuthClient.findUnique({ where: { id: clientId } });
  if (!client) invalidClient();
  const redirects = client!.redirectUris as unknown;
  if (!Array.isArray(redirects) || !redirects.includes(redirectUri)) {
    throw new McpOAuthError('invalid_request', 'Redirect URI does not match the registered client.');
  }
  if (params.get('response_type') !== 'code' || params.get('code_challenge_method') !== 'S256' ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(challenge) ||
      state.length < 8 || state.length > 1024 ||
      resource !== mcpResource() ||
      !requestedScopes.includes(MCP_SCOPE) ||
      requestedScopes.some((item) => item !== MCP_SCOPE && item !== REFRESH_SCOPE)) {
    throw new McpOAuthError('invalid_request', 'Invalid authorization parameters or PKCE challenge.');
  }
  return { clientId, redirectUri, challenge, state, resource,
    scope: requestedScopes.join(' '), clientName: client!.name };
}

export async function approveMcpAuthorization(userId: string, params: AuthorizeParams) {
  await requireCurrentAdmin(userId);
  const code = secret();
  await prisma.mcpOAuthCode.create({
    data: {
      codeHash: digest(code),
      userId,
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      codeChallenge: params.challenge,
      resource: params.resource,
      scope: params.scope,
      expiresAt: new Date(Date.now() + CODE_SECONDS * 1000),
    },
  });
  const destination = new URL(params.redirectUri);
  destination.searchParams.set('code', code);
  destination.searchParams.set('state', params.state);
  // RFC 9207: issuer-bound responses let ChatGPT use its stable OAuth callback.
  destination.searchParams.set('iss', mcpOrigin());
  return destination.toString();
}

export function denyMcpAuthorization(params: AuthorizeParams) {
  const destination = new URL(params.redirectUri);
  destination.searchParams.set('error', 'access_denied');
  destination.searchParams.set('state', params.state);
  destination.searchParams.set('iss', mcpOrigin());
  return destination.toString();
}

export async function requireCurrentAdmin(userId: string) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      accountType: 'REAL_USER',
      isManagedAccount: false,
      isActive: true,
      status: 'ACTIVE',
      staffAssignments: { some: { role: 'ADMIN', isActive: true } },
    },
    select: { id: true, displayName: true },
  });
  if (!user) throw new McpOAuthError('access_denied', 'Active administrator privileges are required.', 403);
  return user;
}

function verifyPkce(codeVerifier: string, codeChallenge: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)) return false;
  const computed = createHash('sha256').update(codeVerifier).digest('base64url');
  const left = Buffer.from(computed);
  const right = Buffer.from(codeChallenge);
  return left.length === right.length && timingSafeEqual(left, right);
}

// Build the replacement before consuming a refresh token. Both writes are committed
// together during rotation, so a database error never strands the client.
function prepareTokens(userId: string, clientId: string, scope: string, resource: string) {
  const accessToken = secret();
  // A refresh token is issued for every approved admin MCP connection. Some MCP
  // clients request only the protected-resource scope (mcp:tools), not the
  // authorization-server's optional offline_access scope.
  const refreshToken = secret();
  const now = Date.now();
  return {
    data: {
      userId, clientId, scope, resource,
      accessHash: digest(accessToken),
      refreshHash: digest(refreshToken),
      expiresAt: new Date(now + ACCESS_SECONDS * 1000),
      refreshExpiresAt: new Date(now + REFRESH_SECONDS * 1000),
    },
    response: {
      access_token: accessToken,
      token_type: 'Bearer' as const,
      expires_in: ACCESS_SECONDS,
      scope,
      refresh_token: refreshToken,
    },
  };
}

async function issueTokens(userId: string, clientId: string, scope: string, resource: string) {
  const issued = prepareTokens(userId, clientId, scope, resource);
  await prisma.mcpOAuthToken.create({ data: issued.data });
  return issued.response;
}

export async function exchangeMcpToken(form: URLSearchParams) {
  const grant = form.get('grant_type');
  const clientId = form.get('client_id') || '';
  if (!clientId || !(await prisma.mcpOAuthClient.findUnique({ where: { id: clientId } }))) invalidClient();
  if (grant === 'authorization_code') {
    const code = form.get('code') || '';
    const redirectUri = form.get('redirect_uri') || '';
    const verifier = form.get('code_verifier') || '';
    const row = await prisma.mcpOAuthCode.findUnique({ where: { codeHash: digest(code) } });
    if (!row || row.clientId !== clientId || row.redirectUri !== redirectUri ||
        row.expiresAt <= new Date() || row.consumedAt ||
        !verifyPkce(verifier, row.codeChallenge) ||
        (form.has('resource') && form.get('resource') !== row.resource)) {
      throw new McpOAuthError('invalid_grant', 'Expired or invalid authorization code.');
    }
    await requireCurrentAdmin(row.userId);
    const consumed = await prisma.mcpOAuthCode.updateMany({
      where: { id: row.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new McpOAuthError('invalid_grant', 'Authorization code already redeemed.');
    return issueTokens(row.userId, clientId, row.scope, row.resource);
  }
  if (grant === 'refresh_token') {
    const incoming = form.get('refresh_token') || '';
    const old = await prisma.mcpOAuthToken.findUnique({ where: { refreshHash: digest(incoming) } });
    if (!old || old.clientId !== clientId || old.revokedAt ||
        !old.refreshExpiresAt || old.refreshExpiresAt <= new Date() ||
        (form.has('resource') && form.get('resource') !== old.resource)) {
      throw new McpOAuthError('invalid_grant', 'Expired or invalid refresh token.');
    }
    await requireCurrentAdmin(old.userId);
    const issued = prepareTokens(old.userId, clientId, old.scope, old.resource);
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.mcpOAuthToken.updateMany({
        where: { id: old.id, refreshHash: digest(incoming), revokedAt: null,
          refreshExpiresAt: { gt: new Date() } },
        // Invalidate only the old refresh token. An existing access token can
        // continue serving in-flight requests until its own normal expiry.
        data: { refreshHash: null },
      });
      if (consumed.count !== 1) {
        throw new McpOAuthError('invalid_grant', 'Refresh token already rotated.');
      }
      await tx.mcpOAuthToken.create({ data: issued.data });
    });
    return issued.response;
  }
  throw new McpOAuthError('unsupported_grant_type', 'Use authorization_code or refresh_token.');
}

export async function requireMcpAccess(authorization: string | null) {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) throw new McpOAuthError('invalid_token', 'MCP bearer token required.', 401);
  const row = await prisma.mcpOAuthToken.findUnique({
    where: { accessHash: digest(token) },
  });
  if (!row || row.revokedAt || row.expiresAt <= new Date() || row.resource !== mcpResource() ||
      !row.scope.split(' ').includes(MCP_SCOPE)) {
    throw new McpOAuthError('invalid_token', 'MCP bearer token expired or invalid.', 401);
  }
  return requireCurrentAdmin(row.userId);
}

export async function revokeMcpToken(form: URLSearchParams) {
  const clientId = form.get('client_id') || '';
  const token = form.get('token') || '';
  if (!clientId) invalidClient();
  await prisma.mcpOAuthToken.updateMany({
    where: { clientId, OR: [{ accessHash: digest(token) }, { refreshHash: digest(token) }] },
    data: { revokedAt: new Date(), refreshHash: null },
  });
}
