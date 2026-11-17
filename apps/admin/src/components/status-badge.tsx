import { AlertCircle, CheckCircle2, HelpCircle, Loader2, XCircle } from 'lucide-react';

export type BadgeTone = 'ok' | 'error' | 'warn' | 'pending' | 'muted';

const TONE_STYLES: Record<BadgeTone, string> = {
  ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  error: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  pending: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  muted: 'border-zinc-700/60 bg-zinc-800/50 text-zinc-400',
};

export function resolveStatusPresentation(status: string): {
  readonly label: string;
  readonly tone: BadgeTone;
} {
  switch (status.toLowerCase()) {
    case 'operational':
    case 'connected':
    case 'completed':
    case 'ready':
      return { label: status, tone: 'ok' };
    case 'stopped':
    case 'disconnected':
    case 'failed':
    case 'unavailable':
      return { label: status, tone: 'error' };
    case 'not_configured':
    case 'unknown':
    case 'degraded':
      return { label: status, tone: 'warn' };
    case 'active':
    case 'waiting':
    case 'delayed':
    case 'prioritized':
      return { label: status, tone: 'pending' };
    default:
      return { label: status, tone: 'muted' };
  }
}

export function StatusBadge({ status, label }: { readonly status: string; readonly label?: string }) {
  const presentation = resolveStatusPresentation(status);
  const displayLabel = label ?? presentation.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide ${TONE_STYLES[presentation.tone]}`}
    >
      {presentation.tone === 'ok' && <CheckCircle2 className="h-3.5 w-3.5" />}
      {presentation.tone === 'error' && <XCircle className="h-3.5 w-3.5" />}
      {presentation.tone === 'warn' && <AlertCircle className="h-3.5 w-3.5" />}
      {presentation.tone === 'pending' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {presentation.tone === 'muted' && <HelpCircle className="h-3.5 w-3.5" />}
      <span>{displayLabel}</span>
    </span>
  );
}
