import type { TenantId } from '@rsd-sync/shared';
import type { AiMessage } from '../providers/index.js';

export interface ConversationContextWindow {
  readonly tenantId: TenantId;
  readonly conversationId: string;
  readonly recentMessages: readonly AiMessage[];
  readonly maxMessages: number;
}

export function trimConversationContext(
  messages: readonly AiMessage[],
  maxMessages: number,
): readonly AiMessage[] {
  if (maxMessages <= 0) {
    return [];
  }
  if (messages.length <= maxMessages) {
    return messages;
  }
  return messages.slice(messages.length - maxMessages);
}

export function isDailyCostLimitExceeded(currentCostUsd: number, dailyLimitUsd: number): boolean {
  return currentCostUsd >= dailyLimitUsd;
}
