import type { PlatformConfig } from '@rsd-sync/configuration';
import { BotOperationsRepository, type PostgresDatabaseClient } from '@rsd-sync/database';
import { WhatsAppCloudApiAdapter } from '@rsd-sync/integrations';
import type { StructuredLogger } from '@rsd-sync/observability';
import type { WhatsappOutboundJobPayload, WhatsappOutboundJobResult } from '@rsd-sync/queue';
import { asTenantId } from '@rsd-sync/shared';
import type { Job } from 'bullmq';

export interface WhatsappOutboundProcessorDeps {
  readonly workerId: string;
  readonly config: PlatformConfig;
  readonly logger: StructuredLogger;
  readonly database: PostgresDatabaseClient;
}

export function createWhatsappOutboundProcessor(deps: WhatsappOutboundProcessorDeps) {
  const repo = new BotOperationsRepository(deps.database);

  return async (job: Job<WhatsappOutboundJobPayload>): Promise<WhatsappOutboundJobResult> => {
    const payload = job.data;
    const tenantId = asTenantId(payload.tenantId);

    const adapter = new WhatsAppCloudApiAdapter({
      deliveryMode: payload.deliveryMode,
      phoneNumberId: payload.phoneNumberId,
      accessToken: deps.config.WHATSAPP_ACCESS_TOKEN,
      apiVersion: deps.config.WHATSAPP_API_VERSION,
    });

    const sendResult = await adapter.sendMessage({
      tenantId,
      toPhoneE164: payload.toPhoneE164,
      type: 'text',
      textBody: payload.textBody,
      idempotencyKey: payload.idempotencyKey,
    });

    const recorded = await repo.recordMessage(tenantId, {
      conversationId: payload.conversationId,
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      senderType: payload.senderType,
      content: payload.textBody,
      externalMessageId: sendResult.externalMessageId,
      metadata: {
        ...(payload.metadata ?? {}),
        deliveryMode: payload.deliveryMode,
        acceptedAt: sendResult.acceptedAt,
      },
    });

    deps.logger.info('Dispatched WhatsApp outbound message', {
      workerId: deps.workerId,
      tenantId,
      conversationId: payload.conversationId,
      senderType: payload.senderType,
      deliveryMode: payload.deliveryMode,
      externalMessageId: sendResult.externalMessageId,
    });

    return {
      externalMessageId: sendResult.externalMessageId,
      acceptedAt: sendResult.acceptedAt,
      messageId: recorded.messageId,
    };
  };
}
