import type { AdminSession } from './auth';
import { getAdminServerConfig } from './server-config';
import type { PlatformStatusDto, TestJobDto } from './types';

function buildBackendHeaders(session: AdminSession): HeadersInit {
  const config = getAdminServerConfig();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (session.accessToken) {
    headers['authorization'] = `Bearer ${session.accessToken}`;
  }
  if (config.adminApiKey) {
    headers['x-admin-api-key'] = config.adminApiKey;
  }

  return headers;
}

export async function fetchPlatformStatus(session: AdminSession): Promise<PlatformStatusDto> {
  const config = getAdminServerConfig();
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(`${config.apiUrl}/api/v1/status`, {
      method: 'GET',
      headers: buildBackendHeaders(session),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      return {
        apiAvailable: response.status < 500,
        checkedAt,
        error:
          errorPayload?.error?.message ??
          `API respondió con código HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as PlatformStatusDto['data'];
    return {
      apiAvailable: true,
      checkedAt,
      data,
    };
  } catch (error) {
    return {
      apiAvailable: false,
      checkedAt,
      error:
        error instanceof Error
          ? `No se pudo conectar con la API (${error.message})`
          : 'No se pudo conectar con la API',
    };
  }
}

export async function fetchPlatformJobs(session: AdminSession): Promise<{
  readonly ok: boolean;
  readonly apiAvailable: boolean;
  readonly jobs: readonly TestJobDto[];
  readonly error?: string | undefined;
}> {
  const config = getAdminServerConfig();
  try {
    const response = await fetch(`${config.apiUrl}/api/v1/jobs`, {
      method: 'GET',
      headers: buildBackendHeaders(session),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        ok: false,
        apiAvailable: response.status < 500,
        jobs: [],
        error: `Error al consultar trabajos (HTTP ${response.status})`,
      };
    }

    const payload = (await response.json()) as { jobs?: TestJobDto[] };
    return {
      ok: true,
      apiAvailable: true,
      jobs: payload.jobs ?? [],
    };
  } catch (error) {
    return {
      ok: false,
      apiAvailable: false,
      jobs: [],
      error:
        error instanceof Error
          ? `API no disponible (${error.message})`
          : 'API no disponible',
    };
  }
}

export async function enqueuePlatformTestJob(
  session: AdminSession,
  input: {
    readonly message: string;
    readonly shouldFail: boolean;
    readonly delayMs: number;
  },
): Promise<{
  readonly ok: boolean;
  readonly job?: TestJobDto | undefined;
  readonly error?: string | undefined;
}> {
  const config = getAdminServerConfig();
  try {
    const response = await fetch(`${config.apiUrl}/api/v1/jobs/test`, {
      method: 'POST',
      headers: buildBackendHeaders(session),
      body: JSON.stringify(input),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    const payload = (await response.json().catch(() => null)) as {
      job?: TestJobDto;
      error?: { message?: string };
    } | null;

    if (!response.ok || !payload?.job) {
      return {
        ok: false,
        error: payload?.error?.message ?? `Error en API (HTTP ${response.status})`,
      };
    }

    return {
      ok: true,
      job: payload.job,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `No se pudo encolar el trabajo (${error.message})`
          : 'No se pudo encolar el trabajo',
    };
  }
}

export async function fetchPlatformJobById(
  session: AdminSession,
  jobId: string,
): Promise<{
  readonly ok: boolean;
  readonly job?: TestJobDto | undefined;
  readonly error?: string | undefined;
}> {
  const config = getAdminServerConfig();
  try {
    const response = await fetch(`${config.apiUrl}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      headers: buildBackendHeaders(session),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    const payload = (await response.json().catch(() => null)) as {
      job?: TestJobDto;
      error?: { message?: string };
    } | null;

    if (!response.ok || !payload?.job) {
      return {
        ok: false,
        error: payload?.error?.message ?? `Trabajo no encontrado (HTTP ${response.status})`,
      };
    }

    return {
      ok: true,
      job: payload.job,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Error consultando trabajo (${error.message})`
          : 'Error consultando trabajo',
    };
  }
}
