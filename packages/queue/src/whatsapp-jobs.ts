import { Queue, Worker, type ConnectionOptions, type Processor } from 'bullmq';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { DEFAULT_RETRY_POLICY, QUEUE_NAMES } from './index.js';

export const WHATSAPP_INBOUND_JOB_NAME = 'whatsapp.inbound.message';
export const WHATSAPP_OUTBOUND_JOB_NAME = 'whatsapp.outbound.message';

export const WhatsappInboundJobPayloadSchema = z.object({
  tenantId: z.string().min(1),
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  phoneNumberId: z.string().min(1),
  externalMessageId: z.string().min(1),
  fromPhoneE164: z.string().min(4),
  contactName: z.string().optional(),
  textBody: z.string().min(1),
  receivedAt: z.string().min(1),
  deliveryMode: z.enum(['local_http', 'cloud_api']).default('local_http'),
});
export type WhatsappInboundJobPayload = z.infer<typeof WhatsappInboundJobPayloadSchema>;

export interface WhatsappInboundJobResult {
  readonly status: 'replied' | 'paused_human' | 'escalated_human' | 'duplicate_skipped';
  readonly conversationId?: string | undefined;
  readonly outboundEnqueued: boolean;
}

export const WhatsappOutboundJobPayloadSchema = z.object({
  tenantId: z.string().min(1),
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  conversationId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  toPhoneE164: z.string().min(4),
  textBody: z.string().min(1),
  senderType: z.enum(['AI', 'HUMAN', 'SYSTEM']).default('AI'),
  deliveryMode: z.enum(['local_http', 'cloud_api']).default('local_http'),
  metadata: z.record(z.unknown()).optional(),
});
export type WhatsappOutboundJobPayload = z.infer<typeof WhatsappOutboundJobPayloadSchema>;

export interface WhatsappOutboundJobResult {
  readonly externalMessageId: string;
  readonly acceptedAt: string;
  readonly messageId: string | null;
}

function asConnectionOptions(redis: Redis): ConnectionOptions {
  return redis as unknown as ConnectionOptions;
}

function sanitizeBullMqJobId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function createWhatsappInboundQueue(
  connection: Redis,
): Queue<WhatsappInboundJobPayload, WhatsappInboundJobResult> {
  return new Queue<WhatsappInboundJobPayload, WhatsappInboundJobResult>(
    QUEUE_NAMES.WHATSAPP_INBOUND,
    {
      connection: asConnectionOptions(connection),
    },
  );
}

export function createWhatsappOutboundQueue(
  connection: Redis,
): Queue<WhatsappOutboundJobPayload, WhatsappOutboundJobResult> {
  return new Queue<WhatsappOutboundJobPayload, WhatsappOutboundJobResult>(
    QUEUE_NAMES.WHATSAPP_OUTBOUND,
    {
      connection: asConnectionOptions(connection),
    },
  );
}

export async function enqueueWhatsappInboundJob(
  queue: Queue<WhatsappInboundJobPayload, WhatsappInboundJobResult>,
  payload: WhatsappInboundJobPayload,
) {
  const validated = WhatsappInboundJobPayloadSchema.parse(payload);
  return queue.add(WHATSAPP_INBOUND_JOB_NAME, validated, {
    jobId: sanitizeBullMqJobId(`wa-in-${validated.idempotencyKey}`),
    attempts: DEFAULT_RETRY_POLICY.maxAttempts,
    backoff: {
      type: 'exponential',
      delay: DEFAULT_RETRY_POLICY.initialBackoffMs,
    },
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}

export async function enqueueWhatsappOutboundJob(
  queue: Queue<WhatsappOutboundJobPayload, WhatsappOutboundJobResult>,
  payload: WhatsappOutboundJobPayload,
) {
  const validated = WhatsappOutboundJobPayloadSchema.parse(payload);
  return queue.add(WHATSAPP_OUTBOUND_JOB_NAME, validated, {
    jobId: sanitizeBullMqJobId(`wa-out-${validated.idempotencyKey}`),
    attempts: DEFAULT_RETRY_POLICY.maxAttempts,
    backoff: {
      type: 'exponential',
      delay: DEFAULT_RETRY_POLICY.initialBackoffMs,
    },
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}

export function createWhatsappInboundWorker(options: {
  readonly connection: Redis;
  readonly concurrency: number;
  readonly processor: Processor<WhatsappInboundJobPayload, WhatsappInboundJobResult>;
}): Worker<WhatsappInboundJobPayload, WhatsappInboundJobResult> {
  return new Worker<WhatsappInboundJobPayload, WhatsappInboundJobResult>(
    QUEUE_NAMES.WHATSAPP_INBOUND,
    options.processor,
    {
      connection: asConnectionOptions(options.connection),
      concurrency: options.concurrency,
    },
  );
}

export function createWhatsappOutboundWorker(options: {
  readonly connection: Redis;
  readonly concurrency: number;
  readonly processor: Processor<WhatsappOutboundJobPayload, WhatsappOutboundJobResult>;
}): Worker<WhatsappOutboundJobPayload, WhatsappOutboundJobResult> {
  return new Worker<WhatsappOutboundJobPayload, WhatsappOutboundJobResult>(
    QUEUE_NAMES.WHATSAPP_OUTBOUND,
    options.processor,
    {
      connection: asConnectionOptions(options.connection),
      concurrency: options.concurrency,
    },
  );
}
