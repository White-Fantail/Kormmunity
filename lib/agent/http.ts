import { NextResponse } from 'next/server';

import { AgentAuthError } from '@/lib/agent/auth';

export class AgentApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = 'bad_request',
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function agentJson(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function agentError(error: unknown) {
  if (error instanceof AgentAuthError || error instanceof AgentApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...('details' in error && error.details !== undefined
            ? { details: error.details }
            : {}),
        },
      },
      { status: error.status },
    );
  }

  console.error('[agent-api] unhandled error', error);
  return NextResponse.json(
    { error: { code: 'internal_error', message: 'Internal server error.' } },
    { status: 500 },
  );
}

export async function readJsonObject(request: Request) {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new AgentApiError('Request body must be valid JSON.', 400, 'invalid_json');
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgentApiError('Request body must be a JSON object.', 400, 'invalid_body');
  }

  return value as Record<string, unknown>;
}
