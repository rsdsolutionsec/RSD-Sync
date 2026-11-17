import { parsePlatformConfig, redactConfigForLogging } from '@rsd-sync/configuration';
import { createLogger, sanitizeLogData, type LogEntry } from '@rsd-sync/observability';
import { asCorrelationId, asTenantId, ValidationError } from '@rsd-sync/shared';
import { describe, expect, it } from 'vitest';

describe('Configuration & Observability', () => {
  it('parses local development defaults safely via Zod', () => {
    const config = parsePlatformConfig({});
    expect(config.NODE_ENV).toBe('development');
    expect(config.API_HOST).toBe('127.0.0.1');
    expect(config.API_PORT).toBe(4000);
    expect(config.WORKER_CONCURRENCY).toBe(5);
    expect(config.SUMAK_ADAPTER_MODE).toBe('readonly');
  });

  it('rejects default placeholder keys when NODE_ENV is production', () => {
    expect(() =>
      parsePlatformConfig({
        NODE_ENV: 'production',
      }),
    ).toThrow(ValidationError);

    const prodConfig = parsePlatformConfig({
      NODE_ENV: 'production',
      ENCRYPTION_MASTER_KEY: 'a-real-32-char-plus-production-master-key-here',
      JWT_SECRET: 'a-real-32-char-plus-production-jwt-secret-value',
    });
    expect(prodConfig.NODE_ENV).toBe('production');
  });

  it('redacts sensitive configuration values and database credentials for logging', () => {
    const config = parsePlatformConfig({
      OPENAI_API_KEY: 'sk-test-secret-key',
      SUMAK_WEBHOOK_SECRET: 'sumak-secret-123',
      DATABASE_URL: 'postgresql://rsd_sync:supersecret@127.0.0.1:54322/rsd_sync_dev',
    });

    const redacted = redactConfigForLogging(config);
    expect(redacted['ENCRYPTION_MASTER_KEY']).toBe('[REDACTED]');
    expect(redacted['JWT_SECRET']).toBe('[REDACTED]');
    expect(redacted['OPENAI_API_KEY']).toBe('[REDACTED]');
    expect(redacted['SUMAK_WEBHOOK_SECRET']).toBe('[REDACTED]');
    expect(String(redacted['DATABASE_URL'])).not.toContain('supersecret');
    expect(String(redacted['DATABASE_URL'])).toContain('***');
  });

  it('sanitizes nested sensitive fields in structured logs', () => {
    const entries: LogEntry[] = [];
    const logger = createLogger({
      service: 'test-service',
      correlationId: asCorrelationId('corr-123'),
      tenantId: asTenantId('tenant-abc'),
      sink: (entry) => entries.push(entry),
    });

    logger.info('Webhook received', {
      headers: {
        authorization: 'Bearer secret-token',
        'x-api-key': 'my-api-key',
        'content-type': 'application/json',
      },
      nested: {
        password: 'plain-password',
        safeField: 'visible',
      },
    });

    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry?.correlationId).toBe('corr-123');
    expect(entry?.tenantId).toBe('tenant-abc');
    expect(JSON.stringify(entry)).not.toContain('secret-token');
    expect(JSON.stringify(entry)).not.toContain('my-api-key');
    expect(JSON.stringify(entry)).not.toContain('plain-password');
    expect(sanitizeLogData({ safe: 'ok', secretValue: 'hide-me' })).toEqual({
      safe: 'ok',
      secretValue: '[REDACTED]',
    });
  });
});
