'use client';

import { Play, RefreshCw, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { TestJobDto } from '@/lib/types';
import { StatusBadge } from './status-badge';

interface JobsViewProps {
  readonly initialJobs: readonly TestJobDto[];
  readonly initialApiAvailable: boolean;
  readonly initialError?: string | undefined;
}

export function JobsView({
  initialJobs,
  initialApiAvailable,
  initialError,
}: JobsViewProps) {
  const [jobs, setJobs] = useState<readonly TestJobDto[]>(initialJobs);
  const [apiAvailable, setApiAvailable] = useState(initialApiAvailable);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedJob, setSelectedJob] = useState<TestJobDto | null>(null);

  const [message, setMessage] = useState('ping desde panel admin');
  const [delayMs, setDelayMs] = useState(0);
  const [shouldFail, setShouldFail] = useState(false);

  async function loadJobs() {
    setLoading(true);
    try {
      const response = await fetch('/api/platform/jobs', { cache: 'no-store' });
      const payload = (await response.json()) as {
        ok: boolean;
        apiAvailable: boolean;
        jobs: TestJobDto[];
        error?: string;
      };
      setApiAvailable(payload.apiAvailable);
      setJobs(payload.jobs ?? []);
      setError(payload.ok ? null : (payload.error ?? 'No se pudieron obtener los trabajos'));
    } finally {
      setLoading(false);
    }
  }

  async function handleEnqueue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/platform/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message,
          delayMs: Number(delayMs) || 0,
          shouldFail,
        }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        job?: TestJobDto;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.job) {
        setError(payload.error ?? 'No se pudo enviar el trabajo de prueba');
        return;
      }

      setSelectedJob(payload.job);
      await new Promise((resolve) => setTimeout(resolve, 400));
      await loadJobs();
    } finally {
      setSubmitting(false);
    }
  }

  async function inspectJob(jobId: string) {
    const response = await fetch(`/api/platform/jobs/${encodeURIComponent(jobId)}`, {
      cache: 'no-store',
    });
    const payload = (await response.json()) as { ok: boolean; job?: TestJobDto };
    if (payload.ok && payload.job) {
      setSelectedJob(payload.job);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Trabajos de Prueba</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Envía trabajos de diagnóstico a BullMQ/Redis y verifica su ejecución por el Worker.
          </p>
        </div>
        <button
          type="button"
          onClick={loadJobs}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-fuchsia-500/40 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Actualizando...' : 'Refrescar cola'}</span>
        </button>
      </div>

      {(!apiAvailable || error) && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200">
          {error ?? 'La API no está disponible para consultar trabajos.'}
        </div>
      )}

      <form
        onSubmit={handleEnqueue}
        className="rounded-xl border border-zinc-800/90 bg-[#0d0d16] p-5"
      >
        <div className="mb-4 text-sm font-medium text-zinc-100">Ejecutar nuevo trabajo de prueba</div>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="job-message" className="mb-1.5 block text-xs text-zinc-400">
              Mensaje de prueba
            </label>
            <input
              id="job-message"
              type="text"
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-[#08080e] px-3 py-2 text-sm text-white focus:border-fuchsia-500/60 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="job-delay" className="mb-1.5 block text-xs text-zinc-400">
              Retardo simulado (ms)
            </label>
            <input
              id="job-delay"
              type="number"
              min={0}
              max={10000}
              value={delayMs}
              onChange={(e) => setDelayMs(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-800 bg-[#08080e] px-3 py-2 text-sm text-white focus:border-fuchsia-500/60 focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white transition hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              <span>{submitting ? 'Encolando...' : 'Ejecutar trabajo'}</span>
            </button>
          </div>
        </div>

        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={shouldFail}
            onChange={(e) => setShouldFail(e.target.checked)}
            className="rounded border-zinc-700 bg-zinc-900 accent-fuchsia-500"
          />
          <span>Simular fallo controlado (para verificar reintentos y manejo de errores)</span>
        </label>
      </form>

      {selectedJob && (
        <div className="rounded-xl border border-fuchsia-500/30 bg-[#0f0f1a] p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-fuchsia-200">
              Detalle del trabajo <span className="font-mono">{selectedJob.jobId}</span>
            </div>
            <StatusBadge status={selectedJob.state} />
          </div>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-zinc-800 bg-black/50 p-3 font-mono text-[11px] text-zinc-300">
            {JSON.stringify(selectedJob, null, 2)}
          </pre>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-800/90 bg-[#0d0d16]">
        <div className="border-b border-zinc-800/80 px-5 py-3.5 text-sm font-medium text-zinc-200">
          Historial reciente en BullMQ ({jobs.length})
        </div>
        {jobs.length === 0 ? (
          <div className="px-5 py-10 text-center text-xs text-zinc-500">
            No hay trabajos de prueba registrados en Redis todavía.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-800/70 bg-[#11111d] text-zinc-400">
                <tr>
                  <th className="px-5 py-3 font-medium">ID</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Intentos</th>
                  <th className="px-5 py-3 font-medium">Creación</th>
                  <th className="px-5 py-3 font-medium">Resultado / Error</th>
                  <th className="px-5 py-3 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {jobs.map((job) => (
                  <tr key={job.jobId} className="hover:bg-zinc-900/40">
                    <td className="px-5 py-3.5 font-mono text-zinc-200">{job.jobId}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={job.state} />
                    </td>
                    <td className="px-5 py-3.5 font-mono text-zinc-300">
                      {job.attemptsMade}/{job.maxAttempts}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-zinc-400">
                      {new Date(job.createdAt).toLocaleString('es-EC')}
                    </td>
                    <td className="max-w-xs truncate px-5 py-3.5 text-zinc-300">
                      {job.result
                        ? `OK (${job.result.durationMs}ms): ${job.result.echoMessage}`
                        : job.failedReason ?? 'Pendiente de ejecución'}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => inspectJob(job.jobId)}
                        className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-fuchsia-500/40 hover:text-white"
                      >
                        <Search className="h-3 w-3" />
                        <span>Inspeccionar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
