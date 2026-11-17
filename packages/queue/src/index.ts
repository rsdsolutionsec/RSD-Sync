import { nowUtcIso, type CorrelationId, type TenantId } from '@rsd-sync/shared';

export const QUEUE_NAMES = {
  EVENTS: 'rsd.events',
  AUTOMATIONS: 'rsd.automations',
  AI_INFERENCE: 'rsd.ai-inference',
  WHATSAPP_INBOUND: 'rsd.whatsapp-inbound',
  WHATSAPP_OUTBOUND: 'rsd.whatsapp-outbound',
  DEAD_LETTER: 'rsd.dead-letter',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly initialBackoffMs: number;
  readonly backoffMultiplier: number;
  readonly maxBackoffMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({
  maxAttempts: 5,
  initialBackoffMs: 1000,
  backoffMultiplier: 2,
  maxBackoffMs: 60000,
});

export interface QueueJobEnvelope<TPayload = Record<string, unknown>> {
  readonly jobId: string;
  readonly queue: QueueName;
  readonly tenantId: TenantId;
  readonly correlationId: CorrelationId;
  readonly idempotencyKey: string;
  readonly attempt: number;
  readonly enqueuedAt: string;
  readonly payload: TPayload;
}

export interface CreateQueueJobInput<TPayload> {
  readonly jobId: string;
  readonly queue: QueueName;
  readonly tenantId: TenantId;
  readonly correlationId: CorrelationId;
  readonly idempotencyKey: string;
  readonly payload: TPayload;
}

export function createQueueJobEnvelope<TPayload>(
  input: CreateQueueJobInput<TPayload>,
): QueueJobEnvelope<TPayload> {
  return {
    jobId: input.jobId,
    queue: input.queue,
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
    attempt: 0,
    enqueuedAt: nowUtcIso(),
    payload: input.payload,
  };
}

export function computeExponentialBackoffMs(
  attempt: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): number {
  const safeAttempt = Math.max(0, attempt);
  const rawDelay = policy.initialBackoffMs * Math.pow(policy.backoffMultiplier, safeAttempt);
  return Math.min(rawDelay, policy.maxBackoffMs);
}
