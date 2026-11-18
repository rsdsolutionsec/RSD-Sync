import { randomUUID } from 'node:crypto';
import type { AiModelProvider } from '@rsd-sync/ai-engine';
import {
  loadLocalEnvIfPresent,
  parsePlatformConfig,
  type PlatformConfig,
} from '@rsd-sync/configuration';
import { PostgresDatabaseClient } from '@rsd-sync/database';
import { createLogger, type StructuredLogger } from '@rsd-sync/observability';
import {
  clearWorkerHeartbeat,
  createRedisConnection,
  createTestJobsWorker,
  createWhatsappInboundWorker,
  createWhatsappOutboundQueue,
  createWhatsappOutboundWorker,
  publishWorkerHeartbeat,
  QUEUE_NAMES,
  type QueueName,
  type TestJobPayload,
  type TestJobResult,
  type WhatsappInboundJobPayload,
  type WhatsappInboundJobResult,
  type WhatsappOutboundJobPayload,
  type WhatsappOutboundJobResult,
} from '@rsd-sync/queue';
import { nowUtcIso } from '@rsd-sync/shared';
import type { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { getQueueSubscriptions } from './consumers/index.js';
import { createTestJobProcessor } from './processors/test-job.js';
import { createWhatsappInboundProcessor } from './processors/whatsapp-inbound.js';
import { createWhatsappOutboundProcessor } from './processors/whatsapp-outbound.js';
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
  readonly database: PostgresDatabaseClient;
  readonly worker: Worker<TestJobPayload, TestJobResult>;
  readonly whatsappInboundWorker: Worker<WhatsappInboundJobPayload, WhatsappInboundJobResult>;
  readonly whatsappOutboundWorker: Worker<WhatsappOutboundJobPayload, WhatsappOutboundJobResult>;
  close(): Promise<void>;
}

export async function startWorkerRuntime(options?: {
  readonly config?: PlatformConfig | undefined;
  readonly logger?: StructuredLogger | undefined;
  readonly workerId?: string | undefined;
  readonly aiProvider?: AiModelProvider | undefined;
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
  const inboundRedis = createRedisConnection(config.REDIS_URL);
  const outboundRedis = createRedisConnection(config.REDIS_URL);
  const queueRedis = createRedisConnection(config.REDIS_URL);
  const heartbeatRedis = createRedisConnection(config.REDIS_URL);

  for (const conn of [redis, inboundRedis, outboundRedis, queueRedis, heartbeatRedis]) {
    conn.on('error', (error) => {
      logger.warn('Worker Redis connection error', { message: error.message });
    });
  }

  const database = PostgresDatabaseClient.fromPlatformConfig(config);
  const whatsappOutboundQueue = createWhatsappOutboundQueue(queueRedis);

  const worker = createTestJobsWorker({
    connection: redis,
    queueName: QUEUE_NAMES.EVENTS,
    concurrency: config.WORKER_CONCURRENCY,
    processor: createTestJobProcessor({ workerId, logger }),
  });

  const whatsappInboundWorker = createWhatsappInboundWorker({
    connection: inboundRedis,
    concurrency: config.WORKER_CONCURRENCY,
    processor: createWhatsappInboundProcessor({
      workerId,
      config,
      logger,
      database,
      outboundQueue: whatsappOutboundQueue,
      aiProvider: options?.aiProvider,
    }),
  });

  const whatsappOutboundWorker = createWhatsappOutboundWorker({
    connection: outboundRedis,
    concurrency: config.WORKER_CONCURRENCY,
    processor: createWhatsappOutboundProcessor({
      workerId,
      config,
      logger,
      database,
    }),
  });

  const attachWorkerLogs = <TData, TResult>(w: Worker<TData, TResult>, queue: QueueName) => {
    w.on('completed', (job) => {
      logger.info('BullMQ worker job completed', {
        workerId,
        jobId: String(job.id ?? ''),
        queue,
      });
    });

    w.on('failed', (job, error) => {
      logger.warn('BullMQ worker job failed', {
        workerId,
        queue,
        jobId: String(job?.id ?? 'unknown'),
        attemptsMade: job?.attemptsMade ?? 0,
        message: error.message,
      });
    });

    w.on('error', (error) => {
      logger.error('BullMQ worker runtime error', {
        workerId,
        queue,
        message: error.message,
      });
    });
  };

  attachWorkerLogs(worker, QUEUE_NAMES.EVENTS);
  attachWorkerLogs(whatsappInboundWorker, QUEUE_NAMES.WHATSAPP_INBOUND);
  attachWorkerLogs(whatsappOutboundWorker, QUEUE_NAMES.WHATSAPP_OUTBOUND);

  await Promise.all([
    worker.waitUntilReady(),
    whatsappInboundWorker.waitUntilReady(),
    whatsappOutboundWorker.waitUntilReady(),
  ]);

  const startedAt = nowUtcIso();
  const activeQueues = [
    QUEUE_NAMES.EVENTS,
    QUEUE_NAMES.WHATSAPP_INBOUND,
    QUEUE_NAMES.WHATSAPP_OUTBOUND,
  ];
  const heartbeatMeta = {
    workerId,
    pid: process.pid,
    concurrency: config.WORKER_CONCURRENCY,
    startedAt,
    queues: activeQueues,
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
    queues: activeQueues,
    aiProvider: config.AI_DEFAULT_PROVIDER,
    aiModel: config.AI_DEFAULT_MODEL,
    whatsappDeliveryMode: config.WHATSAPP_DELIVERY_MODE,
  });

  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) {
      return;
    }
    closed = true;
    clearInterval(heartbeatTimer);
    await Promise.all([
      worker.close().catch(() => undefined),
      whatsappInboundWorker.close().catch(() => undefined),
      whatsappOutboundWorker.close().catch(() => undefined),
    ]);
    await whatsappOutboundQueue.close().catch(() => undefined);
    await clearWorkerHeartbeat(heartbeatRedis).catch(() => undefined);
    await Promise.all(
      [heartbeatRedis, redis, inboundRedis, outboundRedis, queueRedis].map((conn) =>
        conn.quit().catch(() => {
          conn.disconnect();
        }),
      ),
    );
    await database.close().catch(() => undefined);
    logger.info('RSD Sync Worker stopped gracefully', { workerId });
  };

  return {
    workerId,
    config,
    logger,
    redis,
    heartbeatRedis,
    database,
    worker,
    whatsappInboundWorker,
    whatsappOutboundWorker,
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
