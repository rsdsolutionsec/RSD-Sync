export type Brand<T, Name extends string> = T & { readonly __rsdBrand: Name };

export type TenantId = Brand<string, 'TenantId'>;
export type UserId = Brand<string, 'UserId'>;
export type CorrelationId = Brand<string, 'CorrelationId'>;
export type ExecutionId = Brand<string, 'ExecutionId'>;

export function asTenantId(value: string): TenantId {
  if (value.trim().length === 0) {
    throw new ValidationError('TenantId cannot be empty');
  }
  return value as TenantId;
}

export function asUserId(value: string): UserId {
  if (value.trim().length === 0) {
    throw new ValidationError('UserId cannot be empty');
  }
  return value as UserId;
}

export function asCorrelationId(value: string): CorrelationId {
  if (value.trim().length === 0) {
    throw new ValidationError('CorrelationId cannot be empty');
  }
  return value as CorrelationId;
}

export function asExecutionId(value: string): ExecutionId {
  if (value.trim().length === 0) {
    throw new ValidationError('ExecutionId cannot be empty');
  }
  return value as ExecutionId;
}

export type Result<T, E = RsdError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { readonly ok: true; readonly value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { readonly ok: false; readonly error: E } {
  return !result.ok;
}

export class RsdError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown> | undefined;

  public constructor(
    code: string,
    message: string,
    statusCode = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends RsdError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class TenantIsolationError extends RsdError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super('TENANT_ISOLATION_VIOLATION', message, 403, details);
  }
}

export class UnauthorizedOperationError extends RsdError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super('UNAUTHORIZED_OPERATION', message, 403, details);
  }
}

export class ExternalValidationRequiredError extends RsdError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super('EXTERNAL_VALIDATION_REQUIRED', message, 409, details);
  }
}

export function nowUtcIso(): string {
  return new Date().toISOString();
}

export function toUtcIso(date: Date | string | number): string {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError('Invalid date input for UTC ISO conversion');
  }
  return parsed.toISOString();
}
