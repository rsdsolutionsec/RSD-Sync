import { Redis } from 'ioredis';

export interface RedisHealthStatus {
  readonly connected: boolean;
  readonly status: 'connected' | 'disconnected';
  readonly latencyMs: number;
  readonly error?: string | undefined;
}

export function createRedisConnection(
  redisUrl: string,
  options?: {
    readonly lazyConnect?: boolean | undefined;
    readonly connectTimeoutMs?: number | undefined;
  },
): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: options?.lazyConnect ?? false,
    connectTimeout: options?.connectTimeoutMs ?? 5000,
    retryStrategy: (times: number) => Math.min(times * 200, 3000),
  });
}

export async function checkRedisHealth(redis: Redis): Promise<RedisHealthStatus> {
  const start = performance.now();
  try {
    const response = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis PING timed out')), 3000),
      ),
    ]);
    const latencyMs = Math.round(performance.now() - start);
    if (response !== 'PONG') {
      return {
        connected: false,
        status: 'disconnected',
        latencyMs,
        error: `Unexpected Redis PING response: ${response}`,
      };
    }

    return {
      connected: true,
      status: 'connected',
      latencyMs,
    };
  } catch (error) {
    return {
      connected: false,
      status: 'disconnected',
      latencyMs: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : 'Redis health check failed',
    };
  }
}
