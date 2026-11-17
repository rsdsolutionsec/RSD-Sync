import { getAdminBootstrapInfo } from '@rsd-sync/admin';
import { getApiBootstrapInfo } from '@rsd-sync/api';
import { parsePlatformConfig } from '@rsd-sync/configuration';
import {
  AiUsageMetricsSchema,
  DomainEventEnvelopeSchema,
  TenantContextSchema,
} from '@rsd-sync/contracts';
import {
  assertSumakOperationValidated,
  SUMAK_VALIDATION_POLICY,
  SumakCommercialRequestInputSchema,
  SumakEnrollmentRequestInputSchema,
  SumakProductSchema,
} from '@rsd-sync/integrations';
import { TestJobPayloadSchema, TestJobResultSchema } from '@rsd-sync/queue';
import { ExternalValidationRequiredError } from '@rsd-sync/shared';
import { getWorkerBootstrapInfo } from '@rsd-sync/worker';
import { describe, expect, it } from 'vitest';

describe('Platform Contracts, SUMAK Adapter Policy & App Bootstraps', () => {
  it('validates TenantContext, DomainEventEnvelope, and AiUsageMetrics contracts', () => {
    const tenant = TenantContextSchema.parse({
      tenantId: '11111111-1111-4111-8111-111111111111',
      slug: 'sumak',
      timezone: 'America/Guayaquil',
    });
    expect(tenant.limits.maxConcurrentExecutions).toBe(10);

    const event = DomainEventEnvelopeSchema.parse({
      eventId: '33333333-3333-4333-8333-333333333333',
      tenantId: tenant.tenantId,
      eventType: 'whatsapp.message.received',
      correlationId: 'corr-1',
      idempotencyKey: 'abcd1234abcd1234',
      occurredAt: '2026-11-17T01:00:00.000Z',
      payload: { text: 'Hola' },
    });
    expect(event.eventType).toBe('whatsapp.message.received');

    const usage = AiUsageMetricsSchema.parse({
      tenantId: tenant.tenantId,
      provider: 'openai',
      model: 'gpt-4.1-mini',
      inputTokens: 120,
      outputTokens: 45,
      estimatedCostUsd: 0.0012,
      recordedAt: '2026-11-17T01:00:05.000Z',
    });
    expect(usage.inputTokens).toBe(120);
  });

  it('enforces SUMAK adapter non-autonomous confirmation invariants', () => {
    expect(SUMAK_VALIDATION_POLICY).toEqual({
      clientIdentifier: 'SUMAK',
      defaultAccessMode: 'readonly',
      allowAutonomousPaymentConfirmation: false,
      allowAutonomousSaleConfirmation: false,
      allowAutonomousInventoryDeduction: false,
      allowAutonomousEnrollmentConfirmation: false,
    });

    for (const op of [
      'confirm_payment',
      'confirm_sale',
      'deduct_inventory',
      'confirm_enrollment',
    ] as const) {
      expect(() => assertSumakOperationValidated(op, false)).toThrow(
        ExternalValidationRequiredError,
      );
      expect(() => assertSumakOperationValidated(op, true)).not.toThrow();
    }

    expect(
      SumakProductSchema.parse({
        productId: 'prod-1',
        sku: 'SMK-001',
        name: 'Kit Inicial',
        unitPrice: 49.9,
        currency: 'USD',
        active: true,
      }).sku,
    ).toBe('SMK-001');

    expect(
      SumakCommercialRequestInputSchema.parse({
        tenantId: '11111111-1111-4111-8111-111111111111',
        contactPhone: '+593999999999',
        requestedItems: [{ productId: 'prod-1', quantity: 2 }],
      }).requestedItems,
    ).toHaveLength(1);

    expect(
      SumakEnrollmentRequestInputSchema.parse({
        tenantId: '11111111-1111-4111-8111-111111111111',
        courseId: 'course-1',
        applicantName: 'Ana Perez',
        applicantPhone: '+593999999999',
      }).courseId,
    ).toBe('course-1');
  });

  it('exposes Phase 1 bootstrap descriptors without exposing browser admin secrets', () => {
    const config = parsePlatformConfig({});
    const api = getApiBootstrapInfo(config);
    const worker = getWorkerBootstrapInfo(config);
    const admin = getAdminBootstrapInfo(config);

    expect(api.service).toBe('rsd-sync-api');
    expect(api.healthRoutes.map((r) => r.path)).toEqual(['/health/live', '/health/ready']);
    expect(worker.subscriptions.length).toBeGreaterThanOrEqual(5);
    expect(admin.usesGlobalAdminSecretInBrowser).toBe(false);

    const payload = TestJobPayloadSchema.parse({
      correlationId: 'corr-contract-1',
      message: 'smoke-test',
    });
    expect(payload.shouldFail).toBe(false);
    expect(payload.delayMs).toBe(0);

    const result = TestJobResultSchema.parse({
      jobId: 'job-1',
      processedByWorker: 'worker-1',
      processedAt: '2026-11-17T02:00:00.000Z',
      durationMs: 12,
      echoMessage: 'smoke-test',
      attempt: 1,
    });
    expect(result.attempt).toBe(1);
  });
});
