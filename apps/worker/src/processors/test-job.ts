import type { StructuredLogger } from '@rsd-sync/observability';
import {
  PHASE1_TEST_JOB_NAME,
  TestJobPayloadSchema,
  type TestJobPayload,
  type TestJobResult,
} from '@rsd-sync/queue';
import { asCorrelationId, nowUtcIso } from '@rsd-sync/shared';
import type { Job, Processor } from 'bullmq';

export function createTestJobProcessor(options: {
  readonly workerId: string;
  readonly logger: StructuredLogger;
}): Processor<TestJobPayload, TestJobResult> {
  return async (job: Job<TestJobPayload, TestJobResult>): Promise<TestJobResult> => {
    const start = performance.now();

    if (job.name !== PHASE1_TEST_JOB_NAME) {
      throw new Error(`Unsupported job name "${job.name}" in Phase 1 worker`);
    }

    const parsed = TestJobPayloadSchema.parse(job.data);
    const jobLogger = options.logger.child({
      correlationId: asCorrelationId(parsed.correlationId),
    });

    jobLogger.info('Processing BullMQ test job', {
      jobId: String(job.id ?? ''),
      attempt: job.attemptsMade + 1,
      requestedBy: parsed.requestedBy,
    });

    if (parsed.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, parsed.delayMs));
    }

    if (parsed.shouldFail) {
      throw new Error('Simulated test job failure requested by payload');
    }

    const result: TestJobResult = {
      jobId: String(job.id ?? ''),
      processedByWorker: options.workerId,
      processedAt: nowUtcIso(),
      durationMs: Math.round(performance.now() - start),
      echoMessage: parsed.message,
      attempt: job.attemptsMade + 1,
    };

    jobLogger.info('Completed BullMQ test job', {
      jobId: result.jobId,
      durationMs: result.durationMs,
    });

    return result;
  };
}
