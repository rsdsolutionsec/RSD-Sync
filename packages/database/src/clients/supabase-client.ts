import {
  isSupabaseBackendConfigured,
  parseAdminEmails,
  type PlatformConfig,
} from '@rsd-sync/configuration';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseConnectivityState = 'connected' | 'disconnected' | 'not_configured';

export interface SupabaseDiagnosticStatus {
  readonly configured: boolean;
  readonly authConfigured: boolean;
  readonly status: SupabaseConnectivityState;
  readonly latencyMs?: number | undefined;
  readonly error?: string | undefined;
}

export interface VerifiedSupabaseAdminUser {
  readonly id: string;
  readonly email: string;
}

export class SupabaseConnector {
  private readonly adminClient: SupabaseClient | null;
  private readonly supabaseUrl: string | undefined;
  private readonly supabaseAnonKey: string | undefined;
  private readonly allowedAdminEmails: readonly string[];

  public constructor(config: PlatformConfig) {
    this.supabaseUrl = config.SUPABASE_URL;
    this.supabaseAnonKey = config.SUPABASE_ANON_KEY;
    this.allowedAdminEmails = parseAdminEmails(config.ADMIN_EMAILS);

    if (isSupabaseBackendConfigured(config) && config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY) {
      this.adminClient = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } else {
      this.adminClient = null;
    }
  }

  public isConfigured(): boolean {
    return this.adminClient !== null;
  }

  public async checkConnectivity(): Promise<SupabaseDiagnosticStatus> {
    const authConfigured = Boolean(this.supabaseUrl && this.supabaseAnonKey);

    if (!this.adminClient || !this.supabaseUrl || !this.supabaseAnonKey) {
      return {
        configured: false,
        authConfigured,
        status: 'not_configured',
        error: 'Supabase cloud credentials are not configured yet',
      };
    }

    const start = performance.now();
    try {
      const response = await fetch(`${this.supabaseUrl.replace(/\/$/, '')}/auth/v1/health`, {
        headers: {
          apikey: this.supabaseAnonKey,
        },
        signal: AbortSignal.timeout(4000),
      });

      const latencyMs = Math.round(performance.now() - start);

      if (!response.ok) {
        return {
          configured: true,
          authConfigured,
          status: 'disconnected',
          latencyMs,
          error: `Supabase health check returned HTTP ${response.status}`,
        };
      }

      return {
        configured: true,
        authConfigured,
        status: 'connected',
        latencyMs,
      };
    } catch (error) {
      return {
        configured: true,
        authConfigured,
        status: 'disconnected',
        latencyMs: Math.round(performance.now() - start),
        error: error instanceof Error ? error.message : 'Supabase connectivity probe failed',
      };
    }
  }

  public async verifyAdminAccessToken(
    accessToken: string,
  ): Promise<VerifiedSupabaseAdminUser | null> {
    if (!this.adminClient) {
      return null;
    }

    const { data, error } = await this.adminClient.auth.getUser(accessToken);
    if (error || !data.user || !data.user.email) {
      return null;
    }

    const email = data.user.email.toLowerCase();
    if (this.allowedAdminEmails.length === 0 || !this.allowedAdminEmails.includes(email)) {
      return null;
    }

    return {
      id: data.user.id,
      email,
    };
  }
}
