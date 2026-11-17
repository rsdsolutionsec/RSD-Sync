import { nowUtcIso, toUtcIso } from '@rsd-sync/shared';
import {
  Job,
  Queue,
  Worker,
  type ConnectionOptions,
  type JobsOptions,
  type Processor,
} from 'bullmq';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { DEFAULT_RETRY_POLICY, QUEUE_NAMES, type QueueName, type RetryPolicy } from './index.js';

export const PHASE1_TEST_JOB_NAME = 'platform.health.test-job';
export const WORKER_HEARTBEAT_KEY = 'rsd-sync:worker:heartbeat';

export const TestJobPayloadSchema = z.object({
  correlationId: z.string().min(1),
  requestedBy: z.string().min(1).default('system'),
  message: z.string().min(1).max(500).default('ping'),
  shouldFail: z.boolean().default(false),
  delayMs: z.number().int().nonnegative().max(10000).default(0),
});
export type TestJobPayload = z.infer<typeof TestJobPayloadSchema>;

export const TestJobResultSchema = z.object({
  jobId: z.string().min(1),
  processedByWorker: z.string().min(1),
  processedAt: z.string().datetime(),
  durationMs: z.number().nonnegative(),
  echoMessage: z.string(),
  attempt: z.number().int().positive(),
});
export type TestJobResult = z.infer<typeof TestJobResultSchema>;

export interface TestJobRecord {
  readonly jobId: string;
  readonly queue: QueueName;
  readonly name: string;
  readonly state: string;
  readonly attemptsMade: number;
  readonly maxAttempts: number;
  readonly createdAt: string;
  readonly processedAt?: string | undefined;
  readonly finishedAt?: string | undefined;
  readonly data: TestJobPayload;
  readonly result?: TestJobResult | undefined;
  readonly failedReason?: string | undefined;
}

export interface WorkerHeartbeatPayload {
  readonly workerId: string;
  readonly pid: number;
  readonly concurrency: number;
  readonly startedAt: string;
  readonly lastBeatAt: string;
  readonly queues: readonly string[];
}

export interface WorkerPresenceStatus {
  readonly status: 'operational' | 'stopped';
  readonly workerId?: string | undefined;
  readonly concurrency?: number | undefined;
  readonly lastHeartbeatAt?: string | undefined;
  readonly queues: readonly string[];
}

function asConnectionOptions(redis: Redis): ConnectionOptions {
  return redis as unknown as ConnectionOptions;
}

export function createTestJobsQueue(
  connection: Redis,
  queueName: QueueName = QUEUE_NAMES.EVENTS,
): Queue<TestJobPayload, TestJobResult> {
  return new Queue<TestJobPayload, TestJobResult>(queueName, {
    connection: asConnectionOptions(connection),
  });
}

export function createTestJobsWorker(options: {
  readonly connection: Redis;
  readonly queueName?: QueueName | undefined;
  readonly concurrency: number;
  readonly processor: Processor<TestJobPayload, TestJobResult>;
}): Worker<TestJobPayload, TestJobResult> {
  return new Worker<TestJobPayload, TestJobResult>(
    options.queueName ?? QUEUE_NAMES.EVENTS,
    options.processor,
    {
      connection: asConnectionOptions(options.connection),
      concurrency: options.concurrency,
    },
  );
}

export async function enqueueTestJob(
  queue: Queue<TestJobPayload, TestJobResult>,
  payload: TestJobPayload,
  retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY,
  customJobId?: string,
): Promise<TestJobRecord> {
  const parsed = TestJobPayloadSchema.parse(payload);
  const jobOptions: JobsOptions = {
    attempts: retryPolicy.maxAttempts,
    backoff: {
      type: 'exponential',
      delay: retryPolicy.initialBackoffMs,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
    ...(customJobId ? { jobId: customJobId } : {}),
  };

  const job = await queue.add(PHASE1_TEST_JOB_NAME, parsed, jobOptions);
  return formatBullMqJob(job, (queue.name as QueueName) ?? QUEUE_NAMES.EVENTS);
}

async function formatBullMqJob(
  job: Job<TestJobPayload, TestJobResult>,
  queue: QueueName,
  queueInstance?: Queue<TestJobPayload, TestJobResult>,
): Promise<TestJobRecord> {
  let currentJob = job;
  const state = await currentJob.getState();

  // Guard against HGETALL before completion followed by getState() after completion
  if (
    queueInstance &&
    currentJob.id &&
    ((state === 'completed' && currentJob.returnvalue === undefined) ||
      (state === 'failed' && !currentJob.failedReason))
  ) {
    const refreshed = await Job.fromId<TestJobPayload, TestJobResult>(
      queueInstance,
      String(currentJob.id),
    );
    if (refreshed) {
      currentJob = refreshed;
    }
  }

  return {
    jobId: String(currentJob.id ?? ''),
    queue,
    name: currentJob.name,
    state,
    attemptsMade: currentJob.attemptsMade,
    maxAttempts: currentJob.opts.attempts ?? DEFAULT_RETRY_POLICY.maxAttempts,
    createdAt: toUtcIso(currentJob.timestamp || Date.now()),
    ...(currentJob.processedOn ? { processedAt: toUtcIso(currentJob.processedOn) } : {}),
    ...(currentJob.finishedOn ? { finishedAt: toUtcIso(currentJob.finishedOn) } : {}),
    data: currentJob.data,
    ...(currentJob.returnvalue !== undefined && currentJob.returnvalue !== null
      ? { result: currentJob.returnvalue }
      : {}),
    ...(currentJob.failedReason ? { failedReason: currentJob.failedReason } : {}),
  };
}

export async function getTestJobStatus(
  queue: Queue<TestJobPayload, TestJobResult>,
  jobId: string,
): Promise<TestJobRecord | null> {
  const job = await Job.fromId<TestJobPayload, TestJobResult>(queue, jobId);
  if (!job) {
    return null;
  }
  return formatBullMqJob(job, (queue.name as QueueName) ?? QUEUE_NAMES.EVENTS, queue);
}

export async function listRecentTestJobs(
  queue: Queue<TestJobPayload, TestJobResult>,
  limit = 25,
): Promise<readonly TestJobRecord[]> {
  const jobs = await queue.getJobs(
    ['waiting', 'active', 'completed', 'failed', 'delayed'],
    0,
    Math.max(0, limit - 1),
    false,
  );

  const filtered = jobs.filter((job) => job.name === PHASE1_TEST_JOB_NAME);
  const formatted = await Promise.all(
    filtered.map((job) => formatBullMqJob(job, (queue.name as QueueName) ?? QUEUE_NAMES.EVENTS, queue)),
  );

  return formatted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function publishWorkerHeartbeat(
  redis: Redis,
  heartbeat: Omit<WorkerHeartbeatPayload, 'lastBeatAt'>,
  ttlSeconds = 15,
): Promise<void> {
  const payload: WorkerHeartbeatPayload = {
    ...heartbeat,
    lastBeatAt: nowUtcIso(),
  };
  await redis.set(WORKER_HEARTBEAT_KEY, JSON.stringify(payload), 'EX', ttlSeconds);
}

export async function clearWorkerHeartbeat(redis: Redis): Promise<void> {
  await redis.del(WORKER_HEARTBEAT_KEY);
}

export async function getWorkerPresence(redis: Redis): Promise<WorkerPresenceStatus> {
  try {
    const raw = await redis.get(WORKER_HEARTBEAT_KEY);
    if (!raw) {
      return { status: 'stopped', queues: [QUEUE_NAMES.EVENTS] };
    }
    const parsed = JSON.parse(raw) as WorkerHeartbeatPayload;
    return {
      status: 'operational',
      workerId: parsed.workerId,
      concurrency: parsed.concurrency,
      lastHeartbeatAt: parsed.lastBeatAt,
      queues: parsed.queues,
    };
  } catch {
    return { status: 'stopped', queues: [QUEUE_NAMES.EVENTS] };
  }
}
