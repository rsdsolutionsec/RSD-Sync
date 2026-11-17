import type { PostgresDatabaseClient } from '@rsd-sync/database';
import { checkRedisHealth } from '@rsd-sync/queue';
import { nowUtcIso } from '@rsd-sync/shared';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

export interface HealthRouteDefinition {
  readonly method: 'GET';
  readonly path: string;
  readonly purpose: string;
}

export function getHealthEndpointDefinitions(): readonly HealthRouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/health/live',
      purpose: 'Liveness probe confirming API process responsiveness',
    },
    {
      method: 'GET',
      path: '/health/ready',
      purpose: 'Readiness probe verifying Redis and PostgreSQL connectivity (Phase 1+)',
    },
  ];
}

export interface HealthRoutesDeps {
  readonly redis: Redis;
  readonly database: PostgresDatabaseClient;
  readonly startedAtMs: number;
}

export function registerHealthRoutes(app: FastifyInstance, deps: HealthRoutesDeps): void {
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'rsd-sync-api',
      timestamp: nowUtcIso(),
      uptimeSeconds: Math.floor((Date.now() - deps.startedAtMs) / 1000),
    };
  });

  app.get('/health/live', async () => {
    return {
      status: 'alive',
      service: 'rsd-sync-api',
      timestamp: nowUtcIso(),
      uptimeSeconds: Math.floor((Date.now() - deps.startedAtMs) / 1000),
    };
  });

  app.get('/health/ready', async (_request, reply) => {
    const [redisStatus, dbStatus] = await Promise.all([
      checkRedisHealth(deps.redis),
      deps.database.diagnose(),
    ]);

    const ready = redisStatus.connected && dbStatus.connected;
    const statusCode = ready ? 200 : 503;

    return reply.status(statusCode).send({
      status: ready ? 'ready' : 'not_ready',
      service: 'rsd-sync-api',
      timestamp: nowUtcIso(),
      dependencies: {
        redis: {
          status: redisStatus.status,
          latencyMs: redisStatus.latencyMs,
          ...(redisStatus.error ? { error: redisStatus.error } : {}),
        },
        database: {
          status: dbStatus.connected ? 'connected' : 'disconnected',
          target: dbStatus.target,
          latencyMs: dbStatus.latencyMs,
          ...(dbStatus.error ? { error: dbStatus.error } : {}),
        },
      },
    });
  });
}
