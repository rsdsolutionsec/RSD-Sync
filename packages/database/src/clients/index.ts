import type { TenantId } from '@rsd-sync/shared';

export interface QueryResult<TRow> {
  readonly rows: readonly TRow[];
  readonly rowCount: number;
}

export interface DatabaseTransaction {
  query<TRow = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<TRow>>;
}

export interface DatabaseClient {
  query<TRow = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<TRow>>;
  withTenantTransaction<TResult>(
    tenantId: TenantId,
    fn: (tx: DatabaseTransaction) => Promise<TResult>,
  ): Promise<TResult>;
  healthCheck(): Promise<boolean>;
}
