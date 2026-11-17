import {
  isSupabasePublicAuthConfigured,
  loadLocalEnvIfPresent,
  parseAdminEmails,
  parsePlatformConfig,
} from '@rsd-sync/configuration';

export interface AdminServerConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly apiUrl: string;
  readonly adminApiKey: string | undefined;
  readonly adminEmails: readonly string[];
  readonly supabasePublicUrl: string | undefined;
  readonly supabaseAnonKey: string | undefined;
  readonly isSupabaseAuthConfigured: boolean;
  readonly devAdminAccessKey: string | undefined;
  readonly sessionSigningSecret: string;
  readonly isVercel: boolean;
}

export function getAdminServerConfig(): AdminServerConfig {
  loadLocalEnvIfPresent();
  const parsed = parsePlatformConfig();
  const apiUrl = parsed.API_URL || parsed.NEXT_PUBLIC_API_URL;

  return {
    nodeEnv: parsed.NODE_ENV,
    apiUrl: apiUrl.replace(/\/$/, ''),
    adminApiKey: parsed.ADMIN_API_KEY,
    adminEmails: parseAdminEmails(parsed.ADMIN_EMAILS),
    supabasePublicUrl: parsed.NEXT_PUBLIC_SUPABASE_URL ?? parsed.SUPABASE_URL,
    supabaseAnonKey: parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? parsed.SUPABASE_ANON_KEY,
    isSupabaseAuthConfigured:
      isSupabasePublicAuthConfigured(parsed) ||
      Boolean(parsed.SUPABASE_URL && parsed.SUPABASE_ANON_KEY),
    devAdminAccessKey: parsed.DEV_ADMIN_ACCESS_KEY,
    sessionSigningSecret: parsed.JWT_SECRET,
    isVercel: Boolean(process.env['VERCEL']),
  };
}
