import { nowUtcIso, type CorrelationId, type TenantId } from '@rsd-sync/shared';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type ServiceHealthState = 'healthy' | 'degraded' | 'unhealthy';

export interface ServiceHealthStatus {
  readonly service: string;
  readonly state: ServiceHealthState;
  readonly checkedAt: string;
  readonly latencyMs?: number | undefined;
  readonly details?: Record<string, unknown> | undefined;
}

export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly service: string;
  readonly message: string;
  readonly correlationId?: CorrelationId | undefined;
  readonly tenantId?: TenantId | undefined;
  readonly context?: Record<string, unknown> | undefined;
}

export interface StructuredLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(bindings: {
    correlationId?: CorrelationId | undefined;
    tenantId?: TenantId | undefined;
  }): StructuredLogger;
}

const SENSITIVE_FIELD_PATTERNS = [
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'masterkey',
  'master_key',
  'privatekey',
  'private_key',
  'anonkey',
  'anon_key',
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
  return SENSITIVE_FIELD_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function sanitizeLogData(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogData(item, seen));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeLogData(nestedValue, seen);
    }
  }
  return sanitized;
}

export interface CreateLoggerOptions {
  readonly service: string;
  readonly minLevel?: LogLevel | undefined;
  readonly correlationId?: CorrelationId | undefined;
  readonly tenantId?: TenantId | undefined;
  readonly sink?: ((entry: LogEntry) => void) | undefined;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function createLogger(options: CreateLoggerOptions): StructuredLogger {
  const minLevel = options.minLevel ?? 'info';
  const sink =
    options.sink ??
    ((entry: LogEntry) => {
      const line = JSON.stringify(entry);
      if (entry.level === 'error') {
        console.error(line);
      } else {
        console.log(line);
      }
    });

  const emit = (level: LogLevel, message: string, context?: Record<string, unknown>): void => {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) {
      return;
    }

    const sanitizedContext = context
      ? (sanitizeLogData(context) as Record<string, unknown>)
      : undefined;

    const entry: LogEntry = {
      timestamp: nowUtcIso(),
      level,
      service: options.service,
      message,
      ...(options.correlationId !== undefined ? { correlationId: options.correlationId } : {}),
      ...(options.tenantId !== undefined ? { tenantId: options.tenantId } : {}),
      ...(sanitizedContext !== undefined ? { context: sanitizedContext } : {}),
    };

    sink(entry);
  };

  return {
    debug: (message, context) => emit('debug', message, context),
    info: (message, context) => emit('info', message, context),
    warn: (message, context) => emit('warn', message, context),
    error: (message, context) => emit('error', message, context),
    child: (bindings) =>
      createLogger({
        service: options.service,
        minLevel,
        correlationId: bindings.correlationId ?? options.correlationId,
        tenantId: bindings.tenantId ?? options.tenantId,
        sink,
      }),
  };
}
