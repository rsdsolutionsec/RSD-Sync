import type { PlatformConfig } from '@rsd-sync/configuration';
import { resolveEffectiveDatabaseConnection } from '@rsd-sync/configuration';
import type { TenantId } from '@rsd-sync/shared';
import { Pool, type PoolConfig } from 'pg';
import type { DatabaseClient, DatabaseTransaction, QueryResult } from './index.js';

export interface DatabaseDiagnosticResult {
  readonly connected: boolean;
  readonly target: 'local' | 'supabase';
  readonly latencyMs: number;
  readonly error?: string | undefined;
}

function shouldUseSsl(connectionString: string): boolean {
  if (connectionString.includes('sslmode=disable')) {
    return false;
  }
  return (
    connectionString.includes('supabase.co') ||
    connectionString.includes('supabase.com') ||
    connectionString.includes('sslmode=require')
  );
}

export class PostgresDatabaseClient implements DatabaseClient {
  private readonly pool: Pool;
  public readonly target: 'local' | 'supabase';

  public constructor(options: {
    readonly connectionString: string;
    readonly target: 'local' | 'supabase';
    readonly maxConnections?: number | undefined;
    readonly connectionTimeoutMs?: number | undefined;
  }) {
    this.target = options.target;
    const useSsl = shouldUseSsl(options.connectionString);
    const poolConfig: PoolConfig = {
      connectionString: options.connectionString,
      max: options.maxConnections ?? 10,
      connectionTimeoutMillis: options.connectionTimeoutMs ?? 5000,
      idleTimeoutMillis: 30000,
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    };

    this.pool = new Pool(poolConfig);
  }

  public static fromPlatformConfig(
    config: PlatformConfig,
    options?: { readonly useDirectConnection?: boolean | undefined },
  ): PostgresDatabaseClient {
    const resolved = resolveEffectiveDatabaseConnection(config);
    return new PostgresDatabaseClient({
      connectionString: options?.useDirectConnection
        ? resolved.directConnectionString
        : resolved.connectionString,
      target: resolved.target,
    });
  }

  public async query<TRow = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<TRow>> {
    const result = await this.pool.query(sql, params ? [...params] : undefined);
    const normalized = Array.isArray(result) ? result[result.length - 1] : result;
    const rows = (normalized?.rows ?? []) as readonly TRow[];
    return {
      rows,
      rowCount: normalized?.rowCount ?? rows.length,
    };
  }

  public async withTenantTransaction<TResult>(
    tenantId: TenantId,
    fn: (tx: DatabaseTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);

      const tx: DatabaseTransaction = {
        query: async <TRow = Record<string, unknown>>(
          sql: string,
          params?: readonly unknown[],
        ): Promise<QueryResult<TRow>> => {
          const result = await client.query(sql, params ? [...params] : undefined);
          const normalized = Array.isArray(result) ? result[result.length - 1] : result;
          const rows = (normalized?.rows ?? []) as readonly TRow[];
          return {
            rows,
            rowCount: normalized?.rowCount ?? rows.length,
          };
        },
      };

      const output = await fn(tx);
      await client.query('COMMIT');
      return output;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async healthCheck(): Promise<boolean> {
    const diagnostic = await this.diagnose();
    return diagnostic.connected;
  }

  public async diagnose(): Promise<DatabaseDiagnosticResult> {
    const start = performance.now();
    try {
      await this.pool.query('SELECT 1');
      return {
        connected: true,
        target: this.target,
        latencyMs: Math.round(performance.now() - start),
      };
    } catch (error) {
      return {
        connected: false,
        target: this.target,
        latencyMs: Math.round(performance.now() - start),
        error: error instanceof Error ? error.message : 'Database connection check failed',
      };
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
