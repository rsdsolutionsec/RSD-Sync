import type { ChannelType, ConversationMode, PlatformRole } from '@rsd-sync/contracts';
import { assertCanExecuteAction } from '@rsd-sync/security';
import { nowUtcIso, UnauthorizedOperationError, type TenantId, type UserId } from '@rsd-sync/shared';

export interface ConversationState {
  readonly conversationId: string;
  readonly tenantId: TenantId;
  readonly contactId: string;
  readonly channel: ChannelType;
  readonly mode: ConversationMode;
  readonly aiPaused: boolean;
  readonly assignedUserId?: UserId | undefined;
  readonly pauseReason?: string | undefined;
  readonly updatedAt: string;
}

export interface TransitionConversationModeInput {
  readonly nextMode: ConversationMode;
  readonly actorId: UserId;
  readonly actorRole: PlatformRole;
  readonly reason?: string | undefined;
}

export function transitionConversationMode(
  current: ConversationState,
  input: TransitionConversationModeInput,
): ConversationState {
  if (input.actorRole === 'AI_AGENT') {
    throw new UnauthorizedOperationError(
      'AI_AGENT cannot override conversation attention mode',
      { conversationId: current.conversationId, currentMode: current.mode },
    );
  }

  assertCanExecuteAction(input.actorRole, 'conversations:takeover');

  const aiPaused = input.nextMode !== 'AI';

  return {
    ...current,
    mode: input.nextMode,
    aiPaused,
    assignedUserId: input.nextMode === 'AI' ? current.assignedUserId : input.actorId,
    pauseReason: aiPaused ? (input.reason ?? 'Human intervention active') : undefined,
    updatedAt: nowUtcIso(),
  };
}

export function shouldAiAutoReply(conversation: ConversationState): boolean {
  return conversation.mode === 'AI' && !conversation.aiPaused;
}
