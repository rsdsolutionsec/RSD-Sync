import type { TenantId } from '@rsd-sync/shared';

export interface WhatsAppOutboundMessage {
  readonly tenantId: TenantId;
  readonly toPhoneE164: string;
  readonly type: 'text' | 'template';
  readonly textBody?: string | undefined;
  readonly templateName?: string | undefined;
  readonly templateLanguageCode?: string | undefined;
  readonly idempotencyKey: string;
}

export interface WhatsAppSendResult {
  readonly externalMessageId: string;
  readonly acceptedAt: string;
}

export interface WhatsAppInboundMessage {
  readonly externalMessageId: string;
  readonly fromPhoneE164: string;
  readonly contactName?: string | undefined;
  readonly textBody?: string | undefined;
  readonly receivedAt: string;
}

export interface WhatsAppAdapterPort {
  sendMessage(message: WhatsAppOutboundMessage): Promise<WhatsAppSendResult>;
}
