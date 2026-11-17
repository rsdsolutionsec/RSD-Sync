import { randomUUID } from 'node:crypto';
import {
  loadLocalEnvIfPresent,
  parsePlatformConfig,
  type PlatformConfig,
} from '@rsd-sync/configuration';
import { createLogger, type StructuredLogger } from '@rsd-sync/observability';
import {
  clearWorkerHeartbeat,
  createRedisConnection,
  createTestJobsWorker,
  publishWorkerHeartbeat,
  QUEUE_NAMES,
  type QueueName,
  type TestJobPayload,
  type TestJobResult,
} from '@rsd-sync/queue';
import { nowUtcIso } from '@rsd-sync/shared';
import type { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { getQueueSubscriptions } from './consumers/index.js';
import { createTestJobProcessor } from './processors/test-job.js';
import {
  getSchedulerBootstrapDescriptor,
  type SchedulerBootstrapDescriptor,
} from './schedulers/index.js';

export interface WorkerBootstrapInfo {
  readonly service: 'rsd-sync-worker';
  readonly phase: 'phase-1-operational-infra';
  readonly concurrency: number;
  readonly subscriptions: readonly QueueName[];
  readonly scheduler: SchedulerBootstrapDescriptor;
}

export function getWorkerBootstrapInfo(
  config: PlatformConfig = parsePlatformConfig(),
): WorkerBootstrapInfo {
  return {
    service: 'rsd-sync-worker',
    phase: 'phase-1-operational-infra',
    concurrency: config.WORKER_CONCURRENCY,
    subscriptions: getQueueSubscriptions(),
    scheduler: getSchedulerBootstrapDescriptor(),
  };
}

export interface WorkerRuntime {
  readonly workerId: string;
  readonly config: PlatformConfig;
  readonly logger: StructuredLogger;
  readonly redis: Redis;
  readonly heartbeatRedis: Redis;
  readonly worker: Worker<TestJobPayload, TestJobResult>;
  close(): Promise<void>;
}

export async function startWorkerRuntime(options?: {
  readonly config?: PlatformConfig | undefined;
  readonly logger?: StructuredLogger | undefined;
  readonly workerId?: string | undefined;
}): Promise<WorkerRuntime> {
  loadLocalEnvIfPresent();
  const config = options?.config ?? parsePlatformConfig();
  const workerId = options?.workerId ?? `worker-${process.pid}-${randomUUID().slice(0, 8)}`;
  const logger =
    options?.logger ??
    createLogger({
      service: 'rsd-sync-worker',
      minLevel: config.LOG_LEVEL,
    });

  const redis = createRedisConnection(config.REDIS_URL);
  const heartbeatRedis = createRedisConnection(config.REDIS_URL);

  redis.on('error', (error) => {
    logger.warn('Worker BullMQ Redis error', { message: error.message });
  });
  heartbeatRedis.on('error', (error) => {
    logger.warn('Worker heartbeat Redis error', { message: error.message });
  });

  const worker = createTestJobsWorker({
    connection: redis,
    queueName: QUEUE_NAMES.EVENTS,
    concurrency: config.WORKER_CONCURRENCY,
    processor: createTestJobProcessor({ workerId, logger }),
  });

  worker.on('completed', (job) => {
    logger.info('BullMQ worker job completed', {
      workerId,
      jobId: String(job.id ?? ''),
      queue: QUEUE_NAMES.EVENTS,
    });
  });

  worker.on('failed', (job, error) => {
    logger.warn('BullMQ worker job failed', {
      workerId,
      jobId: String(job?.id ?? 'unknown'),
      attemptsMade: job?.attemptsMade ?? 0,
      message: error.message,
    });
  });

  worker.on('error', (error) => {
    logger.error('BullMQ worker runtime error', {
      workerId,
      message: error.message,
    });
  });

  await worker.waitUntilReady();

  const startedAt = nowUtcIso();
  const heartbeatMeta = {
    workerId,
    pid: process.pid,
    concurrency: config.WORKER_CONCURRENCY,
    startedAt,
    queues: [QUEUE_NAMES.EVENTS],
  };

  await publishWorkerHeartbeat(heartbeatRedis, heartbeatMeta).catch((error) => {
    logger.warn('Initial worker heartbeat publish failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  });

  const heartbeatTimer = setInterval(() => {
    void publishWorkerHeartbeat(heartbeatRedis, heartbeatMeta).catch(() => undefined);
  }, 5000);
  heartbeatTimer.unref();

  logger.info('RSD Sync Worker started', {
    workerId,
    concurrency: config.WORKER_CONCURRENCY,
    queue: QUEUE_NAMES.EVENTS,
  });

  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) {
      return;
    }
    closed = true;
    clearInterval(heartbeatTimer);
    await worker.close().catch(() => undefined);
    await clearWorkerHeartbeat(heartbeatRedis).catch(() => undefined);
    await heartbeatRedis.quit().catch(() => {
      heartbeatRedis.disconnect();
    });
    await redis.quit().catch(() => {
      redis.disconnect();
    });
    logger.info('RSD Sync Worker stopped gracefully', { workerId });
  };

  return {
    workerId,
    config,
    logger,
    redis,
    heartbeatRedis,
    worker,
    close,
  };
}

export async function runWorkerProcess(): Promise<WorkerRuntime> {
  const runtime = await startWorkerRuntime();

  const handleSignal = (signal: string) => {
    runtime.logger.info('Worker received shutdown signal', { signal });
    void runtime.close().finally(() => {
      process.exit(0);
    });
  };

  process.once('SIGINT', () => handleSignal('SIGINT'));
  process.once('SIGTERM', () => handleSignal('SIGTERM'));

  return runtime;
}
