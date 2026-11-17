import type { TenantId } from '@rsd-sync/shared';

export interface EmailOutboundMessage {
  readonly tenantId: TenantId;
  readonly to: readonly string[];
  readonly subject: string;
  readonly textBody: string;
  readonly htmlBody?: string | undefined;
}

export interface EmailSendResult {
  readonly messageId: string;
  readonly acceptedAt: string;
}

export interface EmailAdapterPort {
  send(message: EmailOutboundMessage): Promise<EmailSendResult>;
}
