import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiMessage,
  AiModelProvider,
} from './index.js';

export interface GeminiProviderOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}

function sanitizeKeyFromText(text: string, apiKey: string): string {
  if (!apiKey) {
    return text;
  }
  return text.split(apiKey).join('[REDACTED_API_KEY]');
}

function mapRoleToGemini(message: AiMessage): { role: 'user' | 'model'; text: string } {
  if (message.role === 'assistant') {
    return { role: 'model', text: message.content };
  }
  if (message.role === 'tool') {
    return {
      role: 'user',
      text: `[tool:${message.toolName ?? 'unknown'}] ${message.content}`,
    };
  }
  return { role: 'user', text: message.content };
}

export class GeminiAiModelProvider implements AiModelProvider {
  public readonly providerName = 'gemini' as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  public constructor(options: GeminiProviderOptions) {
    if (!options.apiKey || options.apiKey.trim().length === 0) {
      throw new Error('GOOGLE_GENAI_API_KEY is required to initialize GeminiAiModelProvider.');
    }
    this.apiKey = options.apiKey.trim();
    this.baseUrl = (options.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(
      /\/+$/,
      '',
    );
    this.timeoutMs = options.timeoutMs ?? 25_000;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  public async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const systemText = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content.trim())
      .filter((content) => content.length > 0)
      .join('\n\n');

    const conversationContents = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => {
        const mapped = mapRoleToGemini(message);
        return {
          role: mapped.role,
          parts: [{ text: mapped.text }],
        };
      });

    if (conversationContents.length === 0) {
      throw new Error('GeminiAiModelProvider requires at least one non-system message.');
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const endpoint = `${this.baseUrl}/models/${encodeURIComponent(request.model)}:generateContent`;
      const bodyPayload: Record<string, unknown> = {
        contents: conversationContents,
        generationConfig: {
          temperature: request.temperature ?? 0.3,
          maxOutputTokens: request.maxOutputTokens ?? 1024,
        },
      };

      if (systemText.length > 0) {
        bodyPayload.systemInstruction = {
          parts: [{ text: systemText }],
        };
      }

      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const rawError = await response.text().catch(() => 'Unknown error');
        const safeError = sanitizeKeyFromText(rawError.slice(0, 400), this.apiKey);
        throw new Error(`Gemini API request failed with status ${response.status}: ${safeError}`);
      }

      const parsed = (await response.json()) as GeminiGenerateContentResponse;
      const parts = parsed.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .map((part) => part.text ?? '')
        .join('')
        .trim();

      if (text.length === 0) {
        throw new Error('Gemini API returned an empty completion text.');
      }

      return {
        provider: this.providerName,
        model: request.model,
        text,
        toolCalls: [],
        inputTokens: parsed.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: parsed.usageMetadata?.candidatesTokenCount ?? 0,
      };
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error);
      throw new Error(sanitizeKeyFromText(rawMessage, this.apiKey));
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
