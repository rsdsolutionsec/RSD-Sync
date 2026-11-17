import { randomUUID } from 'node:crypto';
import type { DomainEventEnvelope } from '@rsd-sync/contracts';
import { nowUtcIso, type CorrelationId, type TenantId } from '@rsd-sync/shared';

export type EventHandler = (event: DomainEventEnvelope) => Promise<void>;

export interface EventBus {
  publish(event: DomainEventEnvelope): Promise<void>;
}

export interface CreateDomainEventInput {
  readonly tenantId: TenantId;
  readonly eventType: string;
  readonly correlationId: CorrelationId;
  readonly idempotencyKey: string;
  readonly payload: Record<string, unknown>;
}

export function createDomainEvent(input: CreateDomainEventInput): DomainEventEnvelope {
  return {
    eventId: randomUUID(),
    tenantId: input.tenantId,
    eventType: input.eventType,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
    occurredAt: nowUtcIso(),
    payload: input.payload,
  };
}
