import {
  isSupabasePublicAuthConfigured,
  type PlatformConfig,
} from '@rsd-sync/configuration';
import type { PostgresDatabaseClient, SupabaseConnector } from '@rsd-sync/database';
import {
  checkRedisHealth,
  enqueueTestJob,
  getTestJobStatus,
  getWorkerPresence,
  listRecentTestJobs,
  QUEUE_NAMES,
  type TestJobPayload,
  type TestJobResult,
} from '@rsd-sync/queue';
import { nowUtcIso, RsdError, ValidationError } from '@rsd-sync/shared';
import type { Queue } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { authorizeAdminApiRequest } from '../middleware/admin-auth.js';

const EnqueueTestJobBodySchema = z.object({
  message: z.string().trim().min(1).max(500).default('ping'),
  shouldFail: z.boolean().default(false),
  delayMs: z.number().int().nonnegative().max(10000).default(0),
  jobId: z.string().trim().min(1).max(120).optional(),
});

const JobIdParamsSchema = z.object({
  jobId: z.string().trim().min(1).max(120),
});

export interface V1RoutesDeps {
  readonly config: PlatformConfig;
  readonly redis: Redis;
  readonly database: PostgresDatabaseClient;
  readonly supabase: SupabaseConnector;
  readonly testQueue: Queue<TestJobPayload, TestJobResult>;
  readonly startedAtMs: number;
}

export function registerV1Routes(app: FastifyInstance, deps: V1RoutesDeps): void {
  app.get('/api/v1/status', async (request) => {
    await authorizeAdminApiRequest(request, deps.config, deps.supabase);

    const [redisHealth, workerPresence, dbDiagnostic, supabaseStatus] = await Promise.all([
      checkRedisHealth(deps.redis),
      getWorkerPresence(deps.redis),
      deps.database.diagnose(),
      deps.supabase.checkConnectivity(),
    ]);

    return {
      service: 'rsd-sync-api',
      phase: 'phase-1-operational-infra',
      checkedAt: nowUtcIso(),
      environment: {
        nodeEnv: deps.config.NODE_ENV,
        platformName: deps.config.PLATFORM_NAME,
        databaseTarget: dbDiagnostic.target,
      },
      api: {
        status: 'operational',
        host: deps.config.API_HOST,
        port: deps.config.API_PORT,
        uptimeSeconds: Math.floor((Date.now() - deps.startedAtMs) / 1000),
      },
      worker: workerPresence,
      redis: {
        status: redisHealth.status,
        latencyMs: redisHealth.latencyMs,
        ...(redisHealth.error ? { error: redisHealth.error } : {}),
      },
      database: {
        status: dbDiagnostic.connected ? 'connected' : 'disconnected',
        target: dbDiagnostic.target,
        latencyMs: dbDiagnostic.latencyMs,
        ...(dbDiagnostic.error ? { error: dbDiagnostic.error } : {}),
      },
      supabase: {
        status: supabaseStatus.status,
        configured: supabaseStatus.configured,
        authConfigured:
          supabaseStatus.authConfigured || isSupabasePublicAuthConfigured(deps.config),
        ...(supabaseStatus.latencyMs !== undefined
          ? { latencyMs: supabaseStatus.latencyMs }
          : {}),
        ...(supabaseStatus.error ? { error: supabaseStatus.error } : {}),
      },
    };
  });

  app.post('/api/v1/jobs/test', async (request, reply) => {
    const auth = await authorizeAdminApiRequest(request, deps.config, deps.supabase);

    const parsed = EnqueueTestJobBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new ValidationError('Invalid test job request payload', {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const correlationHeader = request.headers['x-correlation-id'];
    const correlationId =
      typeof correlationHeader === 'string' && correlationHeader.trim().length > 0
        ? correlationHeader.trim()
        : request.id;

    const job = await enqueueTestJob(
      deps.testQueue,
      {
        correlationId,
        requestedBy: auth.actor,
        message: parsed.data.message,
        shouldFail: parsed.data.shouldFail,
        delayMs: parsed.data.delayMs,
      },
      undefined,
      parsed.data.jobId,
    );

    return reply.status(202).send({
      accepted: true,
      queue: QUEUE_NAMES.EVENTS,
      correlationId,
      job,
    });
  });

  app.get('/api/v1/jobs', async (request) => {
    await authorizeAdminApiRequest(request, deps.config, deps.supabase);
    const jobs = await listRecentTestJobs(deps.testQueue, 25);
    return {
      queue: QUEUE_NAMES.EVENTS,
      checkedAt: nowUtcIso(),
      jobs,
    };
  });

  app.get('/api/v1/jobs/:jobId', async (request, reply) => {
    await authorizeAdminApiRequest(request, deps.config, deps.supabase);

    const parsedParams = JobIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      throw new ValidationError('Invalid jobId parameter');
    }

    const job = await getTestJobStatus(deps.testQueue, parsedParams.data.jobId);
    if (!job) {
      throw new RsdError('JOB_NOT_FOUND', `Job "${parsedParams.data.jobId}" was not found`, 404);
    }

    return reply.status(200).send({ job });
  });
}
