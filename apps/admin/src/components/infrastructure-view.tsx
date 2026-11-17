'use client';

import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { PlatformStatusDto } from '@/lib/types';
import { StatusBadge } from './status-badge';

interface InfrastructureReadiness {
  readonly nodeEnv: string;
  readonly isVercel: boolean;
  readonly apiUrlConfigured: boolean;
  readonly adminApiKeyConfigured: boolean;
  readonly adminEmailsCount: number;
  readonly supabaseAuthConfigured: boolean;
}

export function InfrastructureView({
  initialStatus,
  readiness,
}: {
  readonly initialStatus: PlatformStatusDto;
  readonly readiness: InfrastructureReadiness;
}) {
  const [status, setStatus] = useState<PlatformStatusDto>(initialStatus);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const response = await fetch('/api/platform/status', { cache: 'no-store' });
      if (response.ok) {
        setStatus((await response.json()) as PlatformStatusDto);
      }
    } finally {
      setRefreshing(false);
    }
  }

  const dependencies = [
    {
      name: 'Fastify API',
      status: status.apiAvailable && status.data ? status.data.api.status : 'unavailable',
      latency: '-',
      detail: status.data
        ? `${status.data.api.host}:${status.data.api.port} (uptime ${status.data.api.uptimeSeconds}s)`
        : status.error ?? 'Sin conexión',
    },
    {
      name: 'Worker BullMQ',
      status: status.data?.worker.status ?? 'unknown',
      latency: '-',
      detail:
        status.data?.worker.status === 'operational'
          ? `ID: ${status.data.worker.workerId} • Colas: ${status.data.worker.queues.join(', ')}`
          : 'Sin heartbeat activo en Redis',
    },
    {
      name: 'Redis',
      status: status.data?.redis.status ?? 'unknown',
      latency: status.data ? `${status.data.redis.latencyMs} ms` : '-',
      detail: status.data?.redis.error ?? 'Broker BullMQ operativo',
    },
    {
      name: 'PostgreSQL / Base Activa',
      status: status.data?.database.status ?? 'unknown',
      latency: status.data ? `${status.data.database.latencyMs} ms` : '-',
      detail: status.data
        ? `Target activo: ${status.data.database.target}${status.data.database.error ? ` (${status.data.database.error})` : ''}`
        : 'Sin conexión verificada',
    },
    {
      name: 'Supabase Cloud (RSD Sync)',
      status: status.data?.supabase.status ?? 'not_configured',
      latency:
        status.data?.supabase.latencyMs !== undefined
          ? `${status.data.supabase.latencyMs} ms`
          : '-',
      detail:
        status.data?.supabase.error ??
        (status.data?.supabase.configured
          ? 'Proyecto Supabase de RSD Sync conectado'
          : 'Pendiente de credenciales del nuevo proyecto Supabase'),
    },
  ];

  const checklist = [
    { label: 'URL de API backend configurada en servidor', ok: readiness.apiUrlConfigured },
    { label: 'Clave interna de API protegida en servidor', ok: readiness.adminApiKeyConfigured },
    {
      label: `Lista de correos administrativos (${readiness.adminEmailsCount} autorizado(s))`,
      ok: readiness.adminEmailsCount > 0,
    },
    {
      label: 'Supabase Auth público configurado',
      ok: readiness.supabaseAuthConfigured,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Diagnóstico de Infraestructura
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Estado técnico de dependencias, entorno activo y preparación para Supabase/Vercel.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-fuchsia-500/40 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Verificando...' : 'Revalidar dependencias'}</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800/90 bg-[#0d0d16]">
        <div className="border-b border-zinc-800/80 px-5 py-3.5 text-sm font-medium text-zinc-200">
          Componentes y Conectividad
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800/70 bg-[#11111d] text-zinc-400">
              <tr>
                <th className="px-5 py-3 font-medium">Servicio</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Latencia</th>
                <th className="px-5 py-3 font-medium">Detalle técnico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {dependencies.map((dep) => (
                <tr key={dep.name} className="hover:bg-zinc-900/40">
                  <td className="px-5 py-3.5 font-medium text-zinc-100">{dep.name}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={dep.status} />
                  </td>
                  <td className="px-5 py-3.5 font-mono text-zinc-300">{dep.latency}</td>
                  <td className="px-5 py-3.5 text-zinc-400">{dep.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800/90 bg-[#0d0d16] p-5">
          <h2 className="text-sm font-medium text-zinc-100">Variables de Entorno del Panel</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Comprobación booleana en servidor (nunca se exponen valores secretos).
          </p>
          <ul className="mt-4 space-y-2.5 text-xs">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2.5 text-zinc-300">
                {item.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                )}
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-zinc-800/90 bg-[#0d0d16] p-5">
          <h2 className="text-sm font-medium text-zinc-100">Contexto de Ejecución</h2>
          <dl className="mt-4 space-y-2.5 text-xs">
            <div className="flex justify-between border-b border-zinc-800/60 pb-2">
              <dt className="text-zinc-400">Entorno Next.js</dt>
              <dd className="font-mono text-zinc-200">{readiness.nodeEnv}</dd>
            </div>
            <div className="flex justify-between border-b border-zinc-800/60 pb-2">
              <dt className="text-zinc-400">Plataforma Vercel</dt>
              <dd className="font-mono text-zinc-200">{readiness.isVercel ? 'Sí' : 'Local'}</dd>
            </div>
            <div className="flex justify-between border-b border-zinc-800/60 pb-2">
              <dt className="text-zinc-400">Base de datos activa (API)</dt>
              <dd className="font-mono text-zinc-200">
                {status.data?.database.target ?? 'desconocido'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Última verificación</dt>
              <dd className="font-mono text-zinc-200">
                {new Date(status.checkedAt).toLocaleString('es-EC')}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
