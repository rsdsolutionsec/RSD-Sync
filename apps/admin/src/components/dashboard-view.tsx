'use client';

import {
  Activity,
  Cloud,
  Cpu,
  Database,
  HardDrive,
  RefreshCw,
  Server,
} from 'lucide-react';
import { useState } from 'react';
import type { PlatformStatusDto } from '@/lib/types';
import { StatusBadge } from './status-badge';

export function DashboardView({
  initialStatus,
}: {
  readonly initialStatus: PlatformStatusDto;
}) {
  const [status, setStatus] = useState<PlatformStatusDto>(initialStatus);
  const [refreshing, setRefreshing] = useState(false);

  async function refreshStatus() {
    setRefreshing(true);
    try {
      const response = await fetch('/api/platform/status', { cache: 'no-store' });
      if (response.ok) {
        const next = (await response.json()) as PlatformStatusDto;
        setStatus(next);
      }
    } finally {
      setRefreshing(false);
    }
  }

  const apiStatus = status.apiAvailable && status.data ? status.data.api.status : 'unavailable';
  const workerStatus = status.data?.worker.status ?? 'unknown';
  const redisStatus = status.data?.redis.status ?? 'unknown';
  const dbStatus = status.data?.database.status ?? 'unknown';
  const supabaseStatus = status.data?.supabase.status ?? 'not_configured';

  const serviceCards = [
    {
      title: 'API Fastify',
      icon: Server,
      status: apiStatus,
      detail: status.data
        ? `Puerto ${status.data.api.port} • Uptime ${status.data.api.uptimeSeconds}s`
        : status.error ?? 'Servicio no accesible',
    },
    {
      title: 'Worker BullMQ',
      icon: Cpu,
      status: workerStatus,
      detail:
        status.data?.worker.status === 'operational'
          ? `Concurrencia ${status.data.worker.concurrency ?? '-'} • ${status.data.worker.workerId ?? 'activo'}`
          : status.apiAvailable
            ? 'Sin heartbeat activo en Redis'
            : 'Requiere API disponible para consultar',
    },
    {
      title: 'Redis',
      icon: HardDrive,
      status: redisStatus,
      detail: status.data
        ? `Latencia ${status.data.redis.latencyMs} ms`
        : 'Sin conexión verificada',
    },
    {
      title: 'Base de Datos',
      icon: Database,
      status: dbStatus,
      detail: status.data
        ? `Destino: ${status.data.database.target} • ${status.data.database.latencyMs} ms`
        : 'Sin conexión verificada',
    },
    {
      title: 'Supabase Cloud (RSD Sync)',
      icon: Cloud,
      status: supabaseStatus,
      detail:
        status.data?.supabase.status === 'connected'
          ? `Conectado • ${status.data.supabase.latencyMs ?? 0} ms`
          : status.data?.supabase.error ?? 'Credenciales cloud aún no configuradas',
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Estado de la Plataforma
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Diagnóstico en tiempo real de los servicios operativos de RSD Sync.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshStatus}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-fuchsia-500/30 bg-violet-600/15 px-4 py-2 text-xs font-medium text-fuchsia-200 transition hover:bg-violet-600/25 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Comprobando...' : 'Actualizar diagnóstico'}</span>
        </button>
      </div>

      {!status.apiAvailable && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          <div className="font-medium">API backend no disponible</div>
          <p className="mt-1 text-xs text-rose-200/80">
            {status.error ??
              'No se pudo establecer comunicación con el servidor Fastify configurado en API_URL.'}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {serviceCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="rounded-xl border border-zinc-800/90 bg-[#0d0d16] p-5 transition hover:border-fuchsia-500/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg border border-zinc-800 bg-[#141422] p-2 text-fuchsia-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-medium text-zinc-100">{card.title}</h2>
                </div>
                <StatusBadge status={card.status} />
              </div>
              <p className="mt-4 text-xs text-zinc-400">{card.detail}</p>
            </div>
          );
        })}

        <div className="rounded-xl border border-zinc-800/90 bg-[#0d0d16] p-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg border border-zinc-800 bg-[#141422] p-2 text-violet-400">
              <Activity className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-medium text-zinc-100">Última comprobación</h2>
          </div>
          <p className="mt-4 font-mono text-xs text-zinc-300">
            {new Date(status.checkedAt).toLocaleString('es-EC')}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Entorno: {status.data?.environment.nodeEnv ?? 'no reportado'}
          </p>
        </div>
      </div>
    </div>
  );
}
