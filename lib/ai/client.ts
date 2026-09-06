const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'openrouter/auto';
const DEFAULT_COST_TIER = 'low';
const DEFAULT_TIMEOUT_MS = 30_000;

type OpenRouterCostTier = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

type ChatCompletionChoice = {
  message?: {
    content?: string | null;
  } | null;
} | null;

type ChatCompletionResponse = {
  model?: string;
  choices?: ChatCompletionChoice[];
  error?: {
    message?: string;
  };
};

type GenerateJsonInput = {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
};

function normalizeApiBaseUrl(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function getTimeoutMs() {
  const raw = Number(process.env.OPENROUTER_TIMEOUT_MS ?? '');
  if (!Number.isFinite(raw) || raw < 1_000 || raw > 120_000) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.floor(raw);
}

function getCostTier(): OpenRouterCostTier {
  const value = process.env.OPENROUTER_COST_TIER?.trim().toLowerCase();
  if (value === 'medium' || value === 'high' || value === 'xhigh' || value === 'max') {
    return value;
  }
  return DEFAULT_COST_TIER;
}

export function isAiGenerationConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function generateJsonWithChatModel<T>({
  systemPrompt,
  userPrompt,
  temperature = 0.8,
  maxTokens = 900,
}: GenerateJsonInput): Promise<T> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY가 설정되지 않아 자동 생성을 사용할 수 없어요.');
  }

  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  const baseUrl = normalizeApiBaseUrl(
    process.env.OPENROUTER_API_BASE_URL?.trim() || DEFAULT_OPENROUTER_BASE_URL,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        plugins: model === 'openrouter/auto'
          ? [{ id: 'auto-router', cost_tier: getCostTier() }]
          : undefined,
        provider: {
          allow_fallbacks: true,
          require_parameters: true,
          data_collection: 'deny',
        },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
    if (!response.ok) {
      const message = payload?.error?.message?.trim();
      throw new Error(message ? `LLM 호출 실패: ${message}` : `LLM 호출 실패: HTTP ${response.status}`);
    }

    const content = payload?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('LLM 응답이 비어 있어요.');
    }

    console.info('[ai] OpenRouter generation completed', {
      requestedModel: model,
      selectedModel: payload?.model ?? model,
      costTier: model === 'openrouter/auto' ? getCostTier() : undefined,
    });

    return JSON.parse(content) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LLM 응답 시간이 초과되었어요. 잠시 후 다시 시도해 주세요.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
