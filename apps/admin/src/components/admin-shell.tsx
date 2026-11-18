'use client';

import {
  Activity,
  Bot,
  Boxes,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  PlaySquare,
  Server,
  ShieldCheck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

interface AdminShellProps {
  readonly email: string;
  readonly authMode: 'supabase' | 'local_dev' | 'locked';
  readonly environment: string;
  readonly children: ReactNode;
}

const ACTIVE_NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: Activity },
  { href: '/conversations', label: 'WhatsApp & CRM', icon: MessageSquare },
  { href: '/infrastructure', label: 'Infraestructura', icon: Server },
  { href: '/jobs', label: 'Trabajos de prueba', icon: PlaySquare },
] as const;

const FUTURE_NAV_ITEMS = [
  { label: 'Automatizaciones', phase: 'Fase 2', icon: Boxes },
  { label: 'Seguridad & Tenants', phase: 'Fase 3', icon: ShieldCheck },
  { label: 'AI Engine Avanzado', phase: 'Fase 5', icon: Bot },
] as const;

export function AdminShell({ email, authMode, environment, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#0b0b13] px-4 py-6">
      <div>
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-fuchsia-500/40 bg-gradient-to-br from-violet-600/30 to-fuchsia-600/30 text-fuchsia-300">
            <span className="text-sm font-bold tracking-tight">RS</span>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-white">RSD Sync</div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-400">
              RSD Solutions • Fase 1
            </div>
          </div>
        </div>

        <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Operación Actual
        </div>
        <nav className="space-y-1">
          {ACTIVE_NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'border border-fuchsia-500/30 bg-gradient-to-r from-violet-600/20 to-fuchsia-600/15 font-medium text-white'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-fuchsia-400' : 'text-zinc-500'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Módulos Planificados
        </div>
        <div className="space-y-1">
          {FUTURE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                aria-disabled="true"
                className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-500/80"
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-zinc-600" />
                  <span>{item.label}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/70 px-1.5 py-0.5 text-[10px] text-zinc-500">
                  <Lock className="h-2.5 w-2.5" />
                  {item.phase}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-zinc-800/80 pt-4">
        <div className="mb-3 rounded-lg border border-zinc-800/80 bg-[#0f0f19] p-3">
          <div className="truncate text-xs font-medium text-zinc-200">{email}</div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-400">
            <span>{authMode === 'supabase' ? 'Supabase Auth' : 'Local Dev Gate'}</span>
            <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-300">
              {environment}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>{signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#07070c]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-zinc-800/80 lg:block">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 w-64 border-r border-zinc-800">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-800/80 bg-[#07070c]/90 px-4 py-3 backdrop-blur-md lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg border border-zinc-800 p-2 text-zinc-300 hover:bg-zinc-800 lg:hidden"
              aria-label="Abrir navegación"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <div className="text-xs font-medium text-zinc-400">
              Plataforma Operativa • <span className="text-zinc-200">Control Plane</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
            <span>Núcleo RSD Sync (aislado de clientes)</span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
