import { createLogger, type StructuredLogger } from '@rsd-sync/observability';

export function createApiLogger(): StructuredLogger {
  return createLogger({
    service: 'rsd-sync-api',
  });
}
