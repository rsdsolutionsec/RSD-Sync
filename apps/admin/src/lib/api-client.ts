import type { AdminSession } from './auth';
import { getAdminServerConfig } from './server-config';
import type {
  ConversationDetailDto,
  ConversationModeDto,
  ConversationSummaryDto,
  PlatformStatusDto,
  TestJobDto,
} from './types';

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

export async function fetchConversations(
  session: AdminSession,
  tenantSlug?: string,
): Promise<{
  readonly ok: boolean;
  readonly tenantSlug?: string | undefined;
  readonly conversations: readonly ConversationSummaryDto[];
  readonly error?: string | undefined;
}> {
  const config = getAdminServerConfig();
  try {
    const query = tenantSlug ? `?tenantSlug=${encodeURIComponent(tenantSlug)}` : '';
    const response = await fetch(`${config.apiUrl}/api/v1/conversations${query}`, {
      method: 'GET',
      headers: buildBackendHeaders(session),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    const payload = (await response.json().catch(() => null)) as {
      tenantSlug?: string;
      conversations?: ConversationSummaryDto[];
      error?: { message?: string };
    } | null;

    if (!response.ok) {
      return {
        ok: false,
        conversations: [],
        error:
          payload?.error?.message ?? `No se pudieron listar conversaciones (HTTP ${response.status})`,
      };
    }

    return {
      ok: true,
      tenantSlug: payload?.tenantSlug,
      conversations: payload?.conversations ?? [],
    };
  } catch (error) {
    return {
      ok: false,
      conversations: [],
      error: error instanceof Error ? error.message : 'Error conectando con API',
    };
  }
}

export async function fetchConversationDetail(
  session: AdminSession,
  conversationId: string,
  tenantSlug?: string,
): Promise<{
  readonly ok: boolean;
  readonly detail?: ConversationDetailDto | undefined;
  readonly error?: string | undefined;
}> {
  const config = getAdminServerConfig();
  try {
    const query = tenantSlug ? `?tenantSlug=${encodeURIComponent(tenantSlug)}` : '';
    const response = await fetch(
      `${config.apiUrl}/api/v1/conversations/${encodeURIComponent(conversationId)}/messages${query}`,
      {
        method: 'GET',
        headers: buildBackendHeaders(session),
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      },
    );

    const payload = (await response.json().catch(() => null)) as
      | (ConversationDetailDto & { error?: { message?: string } })
      | null;

    if (!response.ok || !payload?.conversation) {
      return {
        ok: false,
        error:
          payload?.error?.message ?? `No se pudo obtener el detalle (HTTP ${response.status})`,
      };
    }

    return {
      ok: true,
      detail: {
        conversation: payload.conversation,
        messages: payload.messages,
        approvals: payload.approvals,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error conectando con API',
    };
  }
}

export async function simulateWhatsappInbound(
  session: AdminSession,
  input: {
    readonly fromPhoneE164: string;
    readonly contactName?: string | undefined;
    readonly textBody: string;
  },
): Promise<{ readonly ok: boolean; readonly data?: unknown; readonly error?: string | undefined }> {
  const config = getAdminServerConfig();
  try {
    const response = await fetch(`${config.apiUrl}/api/v1/simulator/whatsapp/inbound`, {
      method: 'POST',
      headers: buildBackendHeaders(session),
      body: JSON.stringify(input),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;

    if (!response.ok) {
      return {
        ok: false,
        error: payload?.error?.message ?? `Simulación falló (HTTP ${response.status})`,
      };
    }

    return { ok: true, data: payload };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error ejecutando simulador',
    };
  }
}

export async function updateConversationModeApi(
  session: AdminSession,
  conversationId: string,
  input: { readonly mode: ConversationModeDto; readonly reason?: string | undefined },
): Promise<{ readonly ok: boolean; readonly error?: string | undefined }> {
  const config = getAdminServerConfig();
  try {
    const response = await fetch(
      `${config.apiUrl}/api/v1/conversations/${encodeURIComponent(conversationId)}/mode`,
      {
        method: 'POST',
        headers: buildBackendHeaders(session),
        body: JSON.stringify(input),
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      },
    );

    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;

    if (!response.ok) {
      return {
        ok: false,
        error: payload?.error?.message ?? `Error cambiando modo (HTTP ${response.status})`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error cambiando modo',
    };
  }
}

export async function sendHumanConversationReplyApi(
  session: AdminSession,
  conversationId: string,
  textBody: string,
): Promise<{ readonly ok: boolean; readonly error?: string | undefined }> {
  const config = getAdminServerConfig();
  try {
    const response = await fetch(
      `${config.apiUrl}/api/v1/conversations/${encodeURIComponent(conversationId)}/reply`,
      {
        method: 'POST',
        headers: buildBackendHeaders(session),
        body: JSON.stringify({ textBody }),
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      },
    );

    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;

    if (!response.ok) {
      return {
        ok: false,
        error: payload?.error?.message ?? `Error enviando respuesta (HTTP ${response.status})`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error enviando respuesta',
    };
  }
}
