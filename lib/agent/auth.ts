import { createHash, timingSafeEqual } from 'node:crypto';

import { NextRequest } from 'next/server';

export const AGENT_SCOPES = [
  'agent.accounts.read',
  'agent.metadata.read',
  'agent.posts.read',
  'agent.posts.write',
  'agent.posts.publish',
] as const;

export type AgentScope = (typeof AGENT_SCOPES)[number];

type AgentApiKeyConfig = {
  id: string;
  key: string;
  scopes: AgentScope[];
  name?: string;
};

export type AgentPrincipal = {
  keyId: string;
  name: string | null;
  scopes: Set<AgentScope>;
};

export class AgentAuthError extends Error {
  constructor(
    message: string,
    readonly status = 401,
    readonly code = 'unauthorized',
  ) {
    super(message);
  }
}

let cachedRawConfig: string | undefined;
let cachedConfigs: AgentApiKeyConfig[] = [];

function loadConfigs() {
  const raw = process.env.KORMMUNITY_AGENT_API_KEYS;
  if (raw === cachedRawConfig) return cachedConfigs;

  cachedRawConfig = raw;
  cachedConfigs = [];

  if (!raw) return cachedConfigs;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AgentAuthError(
      'Agent API key configuration is invalid.',
      503,
      'agent_auth_misconfigured',
    );
  }

  if (!Array.isArray(parsed)) {
    throw new AgentAuthError(
      'Agent API key configuration is invalid.',
      503,
      'agent_auth_misconfigured',
    );
  }

  cachedConfigs = parsed.flatMap((item): AgentApiKeyConfig[] => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (
      typeof record.id !== 'string' ||
      !record.id.trim() ||
      typeof record.key !== 'string' ||
      !record.key ||
      !Array.isArray(record.scopes)
    ) {
      return [];
    }

    const scopes = record.scopes.filter((scope): scope is AgentScope =>
      AGENT_SCOPES.includes(scope as AgentScope),
    );

    return [
      {
        id: record.id.trim(),
        key: record.key,
        scopes,
        name: typeof record.name === 'string' ? record.name : undefined,
      },
    ];
  });

  return cachedConfigs;
}

function constantTimeEquals(left: string, right: string) {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function requireAgent(
  request: NextRequest,
  requiredScopes: AgentScope[],
): AgentPrincipal {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new AgentAuthError('Bearer API key is required.');
  }

  const providedKey = match[1].trim();
  const config = loadConfigs().find((candidate) =>
    constantTimeEquals(candidate.key, providedKey),
  );

  if (!config) {
    throw new AgentAuthError('Invalid Agent API key.');
  }

  const scopes = new Set(config.scopes);
  const missingScope = requiredScopes.find((scope) => !scopes.has(scope));
  if (missingScope) {
    throw new AgentAuthError(
      `Missing required scope: ${missingScope}`,
      403,
      'insufficient_scope',
    );
  }

  return {
    keyId: config.id,
    name: config.name ?? null,
    scopes,
  };
}
