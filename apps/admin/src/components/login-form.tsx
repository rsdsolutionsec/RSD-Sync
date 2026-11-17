'use client';

import { createBrowserClient } from '@supabase/ssr';
import { AlertTriangle, Lock, LogIn, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

interface LoginFormProps {
  readonly mode: 'supabase' | 'local_dev' | 'locked';
  readonly supabaseUrl?: string | undefined;
  readonly supabaseAnonKey?: string | undefined;
  readonly reason?: string | undefined;
}

export function LoginForm({ mode, supabaseUrl, supabaseAnonKey, reason }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'supabase' && supabaseUrl && supabaseAnonKey) {
        const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          setError(signInError.message);
          return;
        }

        router.push('/');
        router.refresh();
        return;
      }

      if (mode === 'local_dev') {
        const response = await fetch('/api/auth/dev-login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            accessKey: password,
          }),
        });

        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          setError(payload?.error ?? 'No se pudo iniciar sesión');
          return;
        }

        router.push('/');
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07070c] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-fuchsia-500/20 bg-[#0d0d16] p-8 shadow-2xl shadow-violet-950/20">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-fuchsia-500/40 bg-gradient-to-br from-violet-600/30 to-fuchsia-600/30 text-fuchsia-300">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">RSD Sync Control Plane</h1>
            <p className="text-xs text-zinc-400">Acceso restringido a operadores autorizados</p>
          </div>
        </div>

        {mode === 'locked' ? (
          <div className="space-y-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
              <div>
                <p className="font-medium">Panel bloqueado por seguridad</p>
                <p className="mt-1 text-xs text-rose-200/80">
                  {reason ??
                    'Supabase Auth y ADMIN_EMAILS deben estar configurados en producción.'}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-rose-500/20 bg-black/40 p-3 font-mono text-[11px] text-zinc-300">
              NEXT_PUBLIC_SUPABASE_URL
              <br />
              NEXT_PUBLIC_SUPABASE_ANON_KEY
              <br />
              ADMIN_EMAILS
            </div>
          </div>
        ) : (
          <>
            {mode === 'local_dev' && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  Modo desarrollo local activo. Supabase Auth aún no está configurado; se validará
                  tu correo autorizado y la clave local configurada en el servidor.
                </span>
              </div>
            )}

            {reason && error === null && mode === 'supabase' && (
              <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
                {reason}
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-medium text-zinc-300"
                >
                  Correo autorizado
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@rsdsolutions.com"
                  className="w-full rounded-lg border border-zinc-800 bg-[#08080e] px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-fuchsia-500/60 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-medium text-zinc-300"
                >
                  {mode === 'supabase' ? 'Contraseña' : 'Clave de acceso local'}
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-zinc-800 bg-[#08080e] px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-fuchsia-500/60 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-medium text-white transition hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50"
              >
                <LogIn className="h-4 w-4" />
                <span>{loading ? 'Validando acceso...' : 'Ingresar al panel'}</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
