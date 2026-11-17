import { randomUUID } from 'node:crypto';
import { buildApiServer, type ApiServerRuntime } from '@rsd-sync/api';
import { parsePlatformConfig } from '@rsd-sync/configuration';
import { startWorkerRuntime, type WorkerRuntime } from '@rsd-sync/worker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

async function pollJobUntil(
  baseUrl: string,
  jobId: string,
  apiKey: string,
  predicate: (state: string) => boolean,
  timeoutMs = 8000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
      headers: { 'x-admin-api-key': apiKey },
    });
    if (res.ok) {
      const data = (await res.json()) as { job: { state: string } & Record<string, unknown> };
      if (predicate(data.job.state)) {
        return data.job;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for job ${jobId}`);
}

describe('Phase 1 End-to-End Runtime: Fastify API <-> Redis/BullMQ <-> Independent Worker', () => {
  const adminApiKey = 'phase1-integration-test-admin-key-12345';
  let apiRuntime: ApiServerRuntime;
  let workerRuntime: WorkerRuntime | null = null;
  let baseUrl = '';

  beforeAll(async () => {
    const config = parsePlatformConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      API_HOST: '127.0.0.1',
      API_PORT: '0',
      REDIS_URL: 'redis://127.0.0.1:6379',
      DATABASE_TARGET: 'local',
      DATABASE_URL: 'postgresql://rsd_sync:rsd_sync_dev_password@127.0.0.1:54332/rsd_sync_dev',
      ADMIN_API_KEY: adminApiKey,
      WORKER_CONCURRENCY: '2',
    });

    apiRuntime = await buildApiServer({ config });
    baseUrl = await apiRuntime.listen();
    workerRuntime = await startWorkerRuntime({ config });
  }, 15000);

  afterAll(async () => {
    if (workerRuntime) {
      await workerRuntime.close();
      workerRuntime = null;
    }
    if (apiRuntime) {
      await apiRuntime.close();
    }
  });

  it('responds to /health, /health/live, and /health/ready', async () => {
    const liveRes = await fetch(`${baseUrl}/health/live`);
    expect(liveRes.status).toBe(200);
    const liveBody = (await liveRes.json()) as { status: string };
    expect(liveBody.status).toBe('alive');

    const readyRes = await fetch(`${baseUrl}/health/ready`);
    expect(readyRes.status).toBe(200);
    const readyBody = (await readyRes.json()) as {
      status: string;
      dependencies: { redis: { status: string }; database: { status: string } };
    };
    expect(readyBody.status).toBe('ready');
    expect(readyBody.dependencies.redis.status).toBe('connected');
    expect(readyBody.dependencies.database.status).toBe('connected');
  });

  it('protects /api/v1/* endpoints and reports real service diagnostics without secrets', async () => {
    const unauthRes = await fetch(`${baseUrl}/api/v1/status`);
    expect(unauthRes.status).toBe(403);

    const statusRes = await fetch(`${baseUrl}/api/v1/status`, {
      headers: { 'x-admin-api-key': adminApiKey },
    });
    expect(statusRes.status).toBe(200);
    const body = (await statusRes.json()) as {
      api: { status: string };
      worker: { status: string };
      redis: { status: string };
      database: { status: string; target: string };
      supabase: { status: string };
    };

    expect(body.api.status).toBe('operational');
    expect(body.worker.status).toBe('operational');
    expect(body.redis.status).toBe('connected');
    expect(body.database.status).toBe('connected');
    expect(body.database.target).toBe('local');
    expect(body.supabase.status).toBe('not_configured');
    expect(JSON.stringify(body)).not.toContain(adminApiKey);
  });

  it('enqueues a test job in API, processes it in BullMQ worker, and returns result', async () => {
    const customJobId = `test-ok-${randomUUID()}`;
    const createRes = await fetch(`${baseUrl}/api/v1/jobs/test`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-api-key': adminApiKey,
      },
      body: JSON.stringify({
        jobId: customJobId,
        message: 'hola-phase-1',
        delayMs: 20,
      }),
    });

    expect(createRes.status).toBe(202);

    const completedJob = await pollJobUntil(
      baseUrl,
      customJobId,
      adminApiKey,
      (state) => state === 'completed',
    );

    const result = completedJob['result'] as {
      echoMessage: string;
      processedByWorker: string;
      attempt: number;
    };
    expect(result.echoMessage).toBe('hola-phase-1');
    expect(result.processedByWorker).toBe(workerRuntime?.workerId);
    expect(result.attempt).toBe(1);

    const listRes = await fetch(`${baseUrl}/api/v1/jobs`, {
      headers: { 'x-admin-api-key': adminApiKey },
    });
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { jobs: Array<{ jobId: string }> };
    expect(listBody.jobs.some((j) => j.jobId === customJobId)).toBe(true);
  }, 15000);

  it('records controlled job failure and retry attempts accurately', async () => {
    const failJobId = `test-fail-${randomUUID()}`;
    const createRes = await fetch(`${baseUrl}/api/v1/jobs/test`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-api-key': adminApiKey,
      },
      body: JSON.stringify({
        jobId: failJobId,
        message: 'trigger-failure',
        shouldFail: true,
      }),
    });
    expect(createRes.status).toBe(202);

    // Wait until at least 1 attempt has been processed and failedReason recorded
    const job = await pollJobUntil(
      baseUrl,
      failJobId,
      adminApiKey,
      (state) => state === 'delayed' || state === 'failed',
    );
    expect(String(job['failedReason'])).toContain('Simulated test job failure');
    expect(Number(job['attemptsMade'])).toBeGreaterThanOrEqual(1);
  }, 15000);

  it('reflects stopped worker, queues work while stopped, and completes once upon worker restart', async () => {
    if (workerRuntime) {
      await workerRuntime.close();
      workerRuntime = null;
    }

    const stoppedStatusRes = await fetch(`${baseUrl}/api/v1/status`, {
      headers: { 'x-admin-api-key': adminApiKey },
    });
    const stoppedStatus = (await stoppedStatusRes.json()) as {
      worker: { status: string };
    };
    expect(stoppedStatus.worker.status).toBe('stopped');

    const queuedJobId = `test-restart-${randomUUID()}`;
    const enqueueRes = await fetch(`${baseUrl}/api/v1/jobs/test`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-api-key': adminApiKey,
      },
      body: JSON.stringify({
        jobId: queuedJobId,
        message: 'queued-while-stopped',
      }),
    });
    expect(enqueueRes.status).toBe(202);

    const restartConfig = parsePlatformConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      REDIS_URL: 'redis://127.0.0.1:6379',
      WORKER_CONCURRENCY: '2',
    });
    workerRuntime = await startWorkerRuntime({ config: restartConfig });

    const completedAfterRestart = await pollJobUntil(
      baseUrl,
      queuedJobId,
      adminApiKey,
      (state) => state === 'completed',
    );
    const result = completedAfterRestart['result'] as {
      echoMessage: string;
      attempt: number;
    };
    expect(result.echoMessage).toBe('queued-while-stopped');
    expect(result.attempt).toBe(1);
  }, 15000);
});
