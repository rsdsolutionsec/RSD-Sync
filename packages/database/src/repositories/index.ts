import type { TenantId } from '@rsd-sync/shared';

export interface TenantRepository<TEntity, TCreateInput> {
  findById(tenantId: TenantId, id: string): Promise<TEntity | null>;
  listByTenant(tenantId: TenantId, limit?: number, offset?: number): Promise<readonly TEntity[]>;
  create(tenantId: TenantId, input: TCreateInput): Promise<TEntity>;
}
