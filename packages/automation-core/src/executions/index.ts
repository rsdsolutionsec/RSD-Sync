import type { ExecutionStatus } from '@rsd-sync/contracts';
import { ValidationError, type CorrelationId, type ExecutionId, type TenantId } from '@rsd-sync/shared';

export interface ExecutionRecord {
  readonly executionId: ExecutionId;
  readonly tenantId: TenantId;
  readonly correlationId: CorrelationId;
  readonly idempotencyKey: string;
  readonly eventType: string;
  readonly status: ExecutionStatus;
  readonly attempt: number;
  readonly startedAt: string;
  readonly finishedAt?: string | undefined;
  readonly errorMessage?: string | undefined;
}

const ALLOWED_EXECUTION_TRANSITIONS: Readonly<
  Record<ExecutionStatus, readonly ExecutionStatus[]>
> = {
  PENDING: ['RUNNING', 'CANCELLED'],
  RUNNING: ['COMPLETED', 'FAILED', 'CANCELLED'],
  FAILED: ['RUNNING', 'DEAD_LETTER', 'CANCELLED'],
  COMPLETED: [],
  DEAD_LETTER: [],
  CANCELLED: [],
};

export function canTransitionExecutionStatus(
  from: ExecutionStatus,
  to: ExecutionStatus,
): boolean {
  return ALLOWED_EXECUTION_TRANSITIONS[from].includes(to);
}

export function transitionExecutionStatus(
  from: ExecutionStatus,
  to: ExecutionStatus,
): ExecutionStatus {
  if (!canTransitionExecutionStatus(from, to)) {
    throw new ValidationError(
      `Invalid execution status transition from ${from} to ${to}`,
      { from, to },
    );
  }
  return to;
}
