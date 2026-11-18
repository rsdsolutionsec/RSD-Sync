import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import {
  loadLocalEnvIfPresent,
  parsePlatformConfig,
  type PlatformConfig,
} from '@rsd-sync/configuration';
import { PostgresDatabaseClient, SupabaseConnector } from '@rsd-sync/database';
import { createLogger, type StructuredLogger } from '@rsd-sync/observability';
import {
  createRedisConnection,
  createTestJobsQueue,
  createWhatsappInboundQueue,
  createWhatsappOutboundQueue,
  type TestJobPayload,
  type TestJobResult,
  type WhatsappInboundJobPayload,
  type WhatsappInboundJobResult,
  type WhatsappOutboundJobPayload,
  type WhatsappOutboundJobResult,
} from '@rsd-sync/queue';
import { asCorrelationId, RsdError } from '@rsd-sync/shared';
import type { Queue } from 'bullmq';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import { CORRELATION_HEADER_NAME } from './middleware/tenant-context.js';
import { API_MODULE_BOUNDARIES, type ApiModuleBoundary } from './modules/index.js';
import { registerConversationRoutes } from './routes/conversations.js';
import { getHealthEndpointDefinitions, registerHealthRoutes, type HealthRouteDefinition } from './routes/health.js';
import { registerV1Routes } from './routes/v1.js';
import { registerWhatsappRoutes } from './routes/whatsapp.js';

export interface ApiBootstrapInfo {
  readonly service: 'rsd-sync-api';
  readonly phase: 'phase-1-operational-infra';
  readonly host: string;
  readonly port: number;
  readonly modules: readonly ApiModuleBoundary[];
  readonly healthRoutes: readonly HealthRouteDefinition[];
}

export function getApiBootstrapInfo(
  config: PlatformConfig = parsePlatformConfig(),
): ApiBootstrapInfo {
  return {
    service: 'rsd-sync-api',
    phase: 'phase-1-operational-infra',
    host: config.API_HOST,
    port: config.API_PORT,
    modules: API_MODULE_BOUNDARIES,
    healthRoutes: getHealthEndpointDefinitions(),
  };
}

export interface ApiServerRuntime {
  readonly app: FastifyInstance;
  readonly config: PlatformConfig;
  readonly logger: StructuredLogger;
  readonly redis: Redis;
  readonly database: PostgresDatabaseClient;
  readonly testQueue: Queue<TestJobPayload, TestJobResult>;
  readonly whatsappInboundQueue: Queue<WhatsappInboundJobPayload, WhatsappInboundJobResult>;
  readonly whatsappOutboundQueue: Queue<WhatsappOutboundJobPayload, WhatsappOutboundJobResult>;
  listen(): Promise<string>;
  close(): Promise<void>;
}

export async function buildApiServer(options?: {
  readonly config?: PlatformConfig | undefined;
  readonly logger?: StructuredLogger | undefined;
}): Promise<ApiServerRuntime> {
  loadLocalEnvIfPresent();
  const config = options?.config ?? parsePlatformConfig();
  const logger =
    options?.logger ??
    createLogger({
      service: 'rsd-sync-api',
      minLevel: config.LOG_LEVEL,
    });

  const startedAtMs = Date.now();
  const redis = createRedisConnection(config.REDIS_URL);
  redis.on('error', (error) => {
    logger.warn('Redis client connection error', { message: error.message });
  });

  const database = PostgresDatabaseClient.fromPlatformConfig(config);
  const supabase = new SupabaseConnector(config);
  const testQueue = createTestJobsQueue(redis);
  const whatsappInboundQueue = createWhatsappInboundQueue(redis);
  const whatsappOutboundQueue = createWhatsappOutboundQueue(redis);

  const app = Fastify({
    logger: false,
    genReqId: (req) => {
      const header = req.headers[CORRELATION_HEADER_NAME];
      return typeof header === 'string' && header.trim().length > 0
        ? header.trim()
        : randomUUID();
    },
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: [config.APP_URL, 'http://127.0.0.1:3000', 'http://localhost:3000'],
    credentials: true,
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header(CORRELATION_HEADER_NAME, request.id);
  });

  app.addHook('onResponse', async (request, reply) => {
    const reqLogger = logger.child({
      correlationId: asCorrelationId(request.id),
    });
    reqLogger.info('HTTP request completed', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const reqLogger = logger.child({
      correlationId: asCorrelationId(request.id),
    });

    if (error instanceof RsdError) {
      reqLogger.warn('Domain request error', {
        code: error.code,
        statusCode: error.statusCode,
        message: error.message,
      });
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          correlationId: request.id,
          ...(error.details ? { details: error.details } : {}),
        },
      });
    }

    const fastifyError = error as { statusCode?: number; message?: string };
    const statusCode =
      typeof fastifyError.statusCode === 'number' && fastifyError.statusCode >= 400
        ? fastifyError.statusCode
        : 500;

    reqLogger.error('Unhandled API error', {
      statusCode,
      message: error instanceof Error ? error.message : 'Unknown error',
    });

    return reply.status(statusCode).send({
      error: {
        code: statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST',
        message:
          statusCode >= 500
            ? 'Internal platform error'
            : (fastifyError.message ?? 'Invalid request'),
        correlationId: request.id,
      },
    });
  });

  registerHealthRoutes(app, { redis, database, startedAtMs });
  registerV1Routes(app, { config, redis, database, supabase, testQueue, startedAtMs });
  registerWhatsappRoutes(app, { config, database, supabase, whatsappInboundQueue });
  registerConversationRoutes(app, { config, database, supabase, whatsappOutboundQueue });

  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) {
      return;
    }
    closed = true;
    await app.close().catch(() => undefined);
    await testQueue.close().catch(() => undefined);
    await whatsappInboundQueue.close().catch(() => undefined);
    await whatsappOutboundQueue.close().catch(() => undefined);
    await redis.quit().catch(() => {
      redis.disconnect();
    });
    await database.close().catch(() => undefined);
    logger.info('RSD Sync API stopped gracefully');
  };

  return {
    app,
    config,
    logger,
    redis,
    database,
    testQueue,
    whatsappInboundQueue,
    whatsappOutboundQueue,
    listen: async () => {
      const address = await app.listen({
        host: config.API_HOST,
        port: config.API_PORT,
      });
      logger.info('RSD Sync API listening', {
        address,
        databaseTarget: database.target,
        supabaseConfigured: supabase.isConfigured(),
      });
      return address;
    },
    close,
  };
}

export async function startApiServer(): Promise<ApiServerRuntime> {
  const runtime = await buildApiServer();
  await runtime.listen();

  const handleSignal = (signal: string) => {
    runtime.logger.info('Received shutdown signal', { signal });
    void runtime.close().finally(() => {
      process.exit(0);
    });
  };

  process.once('SIGINT', () => handleSignal('SIGINT'));
  process.once('SIGTERM', () => handleSignal('SIGTERM'));

  return runtime;
}
