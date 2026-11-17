import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  createSignedDevSessionToken,
  DEV_SESSION_COOKIE,
  verifySignedDevSessionToken,
} from './dev-session';
import { getAdminServerConfig } from './server-config';

export { createSignedDevSessionToken, DEV_SESSION_COOKIE, verifySignedDevSessionToken };

export interface AdminSession {
  readonly authenticated: boolean;
  readonly mode: 'supabase' | 'local_dev' | 'locked';
  readonly email?: string | undefined;
  readonly accessToken?: string | undefined;
  readonly reason?: string | undefined;
}

export async function getAdminSession(): Promise<AdminSession> {
  const config = getAdminServerConfig();
  const cookieStore = await cookies();

  if (config.isSupabaseAuthConfigured && config.supabasePublicUrl && config.supabaseAnonKey) {
    const supabase = createServerClient(config.supabasePublicUrl, config.supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Read-only cookie store inside Server Component render
          }
        },
      },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user || !userData.user.email) {
      return {
        authenticated: false,
        mode: 'supabase',
        reason: 'Inicia sesión con tu cuenta administrativa de RSD Sync.',
      };
    }

    const email = userData.user.email.toLowerCase();
    if (config.adminEmails.length === 0 || !config.adminEmails.includes(email)) {
      return {
        authenticated: false,
        mode: 'supabase',
        reason: 'Tu cuenta no está autorizada en ADMIN_EMAILS.',
      };
    }

    const { data: sessionData } = await supabase.auth.getSession();

    return {
      authenticated: true,
      mode: 'supabase',
      email,
      accessToken: sessionData.session?.access_token,
    };
  }

  if (config.nodeEnv === 'production') {
    return {
      authenticated: false,
      mode: 'locked',
      reason:
        'Panel bloqueado en producción hasta configurar Supabase Auth (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y ADMIN_EMAILS).',
    };
  }

  const devCookie = cookieStore.get(DEV_SESSION_COOKIE)?.value;
  const verifiedEmail = verifySignedDevSessionToken(
    devCookie,
    config.sessionSigningSecret,
    config.adminEmails,
  );

  if (!verifiedEmail) {
    return {
      authenticated: false,
      mode: 'local_dev',
      reason: 'Inicia sesión en modo desarrollo local.',
    };
  }

  return {
    authenticated: true,
    mode: 'local_dev',
    email: verifiedEmail,
  };
}
