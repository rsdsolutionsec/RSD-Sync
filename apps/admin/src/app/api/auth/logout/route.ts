import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { DEV_SESSION_COOKIE } from '@/lib/auth';
import { getAdminServerConfig } from '@/lib/server-config';

export async function POST() {
  const config = getAdminServerConfig();
  const cookieStore = await cookies();

  if (config.isSupabaseAuthConfigured && config.supabasePublicUrl && config.supabaseAnonKey) {
    const supabase = createServerClient(config.supabasePublicUrl, config.supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    });
    await supabase.auth.signOut().catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(DEV_SESSION_COOKIE);
  return response;
}
