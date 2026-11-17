import type { ChannelType } from '@rsd-sync/contracts';
import type { TenantId } from '@rsd-sync/shared';

export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageSenderType = 'CUSTOMER' | 'AI' | 'HUMAN' | 'SYSTEM';

export interface ConversationMessage {
  readonly messageId: string;
  readonly tenantId: TenantId;
  readonly conversationId: string;
  readonly channel: ChannelType;
  readonly direction: MessageDirection;
  readonly senderType: MessageSenderType;
  readonly content: string;
  readonly externalMessageId?: string | undefined;
  readonly sentAt: string;
}
