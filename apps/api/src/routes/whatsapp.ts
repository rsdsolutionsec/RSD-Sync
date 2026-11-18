import { timingSafeEqual } from 'node:crypto';
import { computeIdempotencyKey } from '@rsd-sync/automation-core';
import type { PlatformConfig } from '@rsd-sync/configuration';
import { BotOperationsRepository, type PostgresDatabaseClient, type SupabaseConnector } from '@rsd-sync/database';
import { createLocalMetaWebhookPayload, parseMetaWhatsAppWebhookPayload } from '@rsd-sync/integrations';
import {
  enqueueWhatsappInboundJob,
  type WhatsappInboundJobPayload,
  type WhatsappInboundJobResult,
} from '@rsd-sync/queue';
import { computeHmacSha256Signature, verifyHmacSignature } from '@rsd-sync/security';
import { RsdError, UnauthorizedOperationError, ValidationError } from '@rsd-sync/shared';
import type { Queue } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authorizeAdminApiRequest } from '../middleware/admin-auth.js';

const MetaWebhookVerifyQuerySchema = z.object({
  'hub.mode': z.string().optional(),
  'hub.verify_token': z.string().optional(),
  'hub.challenge': z.string().optional(),
});

const SimulatorInboundBodySchema = z.object({
  phoneNumberId: z.string().trim().min(1).max(120).optional(),
  fromPhoneE164: z.string().trim().min(6).max(30),
  contactName: z.string().trim().min(1).max(120).optional(),
  textBody: z.string().trim().min(1).max(4000),
  externalMessageId: z.string().trim().min(1).max(180).optional(),
});

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export interface WhatsappRoutesDeps {
  readonly config: PlatformConfig;
  readonly database: PostgresDatabaseClient;
  readonly supabase: SupabaseConnector;
  readonly whatsappInboundQueue: Queue<WhatsappInboundJobPayload, WhatsappInboundJobResult>;
}

export function registerWhatsappRoutes(app: FastifyInstance, deps: WhatsappRoutesDeps): void {
  const botRepo = new BotOperationsRepository(deps.database);

  // Scoped plugin so raw JSON bytes are preserved exclusively for Meta HMAC-SHA256 verification.
  void app.register(async (webhookApp) => {
    webhookApp.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (request, body, done) => {
        const rawText = body.toString('utf8');
        (request as unknown as { rawBody?: string }).rawBody = rawText;
        try {
          const parsed = rawText.trim().length > 0 ? JSON.parse(rawText) : {};
          done(null, parsed);
        } catch (err) {
          done(err as Error, undefined);
        }
      },
    );

    webhookApp.get('/api/v1/webhooks/whatsapp', async (request, reply) => {
      const parsedQuery = MetaWebhookVerifyQuerySchema.safeParse(request.query ?? {});
      if (!parsedQuery.success) {
        throw new ValidationError('Invalid WhatsApp webhook verification query');
      }

      const mode = parsedQuery.data['hub.mode'];
      const token = parsedQuery.data['hub.verify_token'];
      const challenge = parsedQuery.data['hub.challenge'];
      const expectedToken = deps.config.WHATSAPP_VERIFY_TOKEN;

      if (!expectedToken || mode !== 'subscribe' || !token || !safeEqual(token, expectedToken)) {
        throw new UnauthorizedOperationError('Invalid WhatsApp webhook verification challenge');
      }

      return reply.status(200).type('text/plain').send(challenge ?? '');
    });

    webhookApp.post('/api/v1/webhooks/whatsapp', async (request, reply) => {
      const appSecret = deps.config.WHATSAPP_APP_SECRET;
      if (!appSecret) {
        throw new RsdError(
          'WHATSAPP_SECRET_UNCONFIGURED',
          'WHATSAPP_APP_SECRET is required to accept webhook deliveries',
          503,
        );
      }

      const signatureHeader = request.headers['x-hub-signature-256'];
      const rawBody =
        (request as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(request.body ?? {});

      if (
        typeof signatureHeader !== 'string' ||
        !verifyHmacSignature({
          payload: rawBody,
          signatureHeader,
          secret: appSecret,
          prefix: 'sha256=',
        })
      ) {
        throw new RsdError('INVALID_WEBHOOK_SIGNATURE', 'Invalid WhatsApp webhook HMAC signature', 401);
      }

      let batches;
      try {
        batches = parseMetaWhatsAppWebhookPayload(request.body);
      } catch (error) {
        throw new ValidationError('Invalid Meta WhatsApp webhook payload', {
          reason: error instanceof Error ? error.message : 'Schema mismatch',
        });
      }

      const enqueuedJobs: Array<{
        tenantId: string;
        externalMessageId: string;
        jobId: string;
      }> = [];
      const skippedUnregisteredPhones: string[] = [];

      for (const batch of batches) {
        const tenantId = await botRepo.resolveTenantByChannelAccount(
          'WHATSAPP',
          batch.phoneNumberId,
        );

        if (!tenantId) {
          skippedUnregisteredPhones.push(batch.phoneNumberId);
          continue;
        }

        for (const msg of batch.messages) {
          const idempotencyKey = computeIdempotencyKey({
            tenantId,
            eventType: 'whatsapp.inbound',
            externalId: msg.externalMessageId,
          });

          const job = await enqueueWhatsappInboundJob(deps.whatsappInboundQueue, {
            tenantId,
            correlationId: request.id,
            idempotencyKey,
            phoneNumberId: batch.phoneNumberId,
            externalMessageId: msg.externalMessageId,
            fromPhoneE164: msg.fromPhoneE164,
            contactName: msg.contactName,
            textBody: msg.textBody ?? '',
            receivedAt: msg.receivedAt,
            deliveryMode: deps.config.WHATSAPP_DELIVERY_MODE,
          });

          enqueuedJobs.push({
            tenantId,
            externalMessageId: msg.externalMessageId,
            jobId: String(job.id ?? ''),
          });
        }
      }

      return reply.status(200).send({
        accepted: true,
        enqueued: enqueuedJobs.length,
        jobs: enqueuedJobs,
        ...(skippedUnregisteredPhones.length > 0 ? { skippedUnregisteredPhones } : {}),
      });
    });
  });

  app.post('/api/v1/simulator/whatsapp/inbound', async (request, reply) => {
    await authorizeAdminApiRequest(request, deps.config, deps.supabase);

    const parsed = SimulatorInboundBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new ValidationError('Invalid WhatsApp simulator inbound payload', {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const appSecret = deps.config.WHATSAPP_APP_SECRET;
    if (!appSecret) {
      throw new RsdError(
        'WHATSAPP_SECRET_UNCONFIGURED',
        'WHATSAPP_APP_SECRET must be set to simulate signed WhatsApp webhooks',
        503,
      );
    }

    const phoneNumberId =
      parsed.data.phoneNumberId ?? deps.config.WHATSAPP_PHONE_NUMBER_ID ?? 'local-sumak-phone-id';
    const metaPayload = createLocalMetaWebhookPayload({
      phoneNumberId,
      fromPhoneE164: parsed.data.fromPhoneE164,
      contactName: parsed.data.contactName,
      textBody: parsed.data.textBody,
      externalMessageId: parsed.data.externalMessageId,
    });

    const rawBody = JSON.stringify(metaPayload);
    const signature = computeHmacSha256Signature(rawBody, appSecret, 'sha256=');

    const injected = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/whatsapp',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': signature,
        'x-correlation-id': request.id,
      },
      payload: rawBody,
    });

    const responseBody = injected.json<Record<string, unknown>>();
    return reply.status(injected.statusCode).send({
      simulated: true,
      phoneNumberId,
      webhookResponse: responseBody,
    });
  });
}
