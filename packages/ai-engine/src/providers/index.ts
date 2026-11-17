import type { AiToolMetadata } from '@rsd-sync/contracts';

export type AiProviderName = 'openai' | 'anthropic' | 'gemini' | 'custom';

export interface AiMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly toolName?: string | undefined;
}

export interface AiCompletionRequest {
  readonly model: string;
  readonly messages: readonly AiMessage[];
  readonly tools?: readonly AiToolMetadata[] | undefined;
  readonly temperature?: number | undefined;
  readonly maxOutputTokens?: number | undefined;
}

export interface AiToolCallRequest {
  readonly toolName: string;
  readonly rawArgs: Record<string, unknown>;
}

export interface AiCompletionResponse {
  readonly provider: AiProviderName;
  readonly model: string;
  readonly text: string;
  readonly toolCalls: readonly AiToolCallRequest[];
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface AiModelProvider {
  readonly providerName: AiProviderName;
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;
}
