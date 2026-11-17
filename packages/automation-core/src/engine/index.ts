import { createHash } from 'node:crypto';
import type { DomainEventEnvelope, ExecutionStatus } from '@rsd-sync/contracts';
import { ValidationError, type TenantId } from '@rsd-sync/shared';

export interface ComputeIdempotencyKeyInput {
  readonly tenantId: TenantId;
  readonly eventType: string;
  readonly externalId: string;
  readonly scope?: string | undefined;
}

export function computeIdempotencyKey(input: ComputeIdempotencyKeyInput): string {
  if (input.externalId.trim().length === 0) {
    throw new ValidationError('externalId is required to compute an idempotency key');
  }

  const parts = [
    input.tenantId,
    input.eventType.trim().toLowerCase(),
    input.scope?.trim().toLowerCase() ?? 'default',
    input.externalId.trim(),
  ];

  return createHash('sha256').update(parts.join(':'), 'utf8').digest('hex');
}

export interface AutomationEnginePort {
  dispatch(event: DomainEventEnvelope): Promise<{ readonly status: ExecutionStatus }>;
}
