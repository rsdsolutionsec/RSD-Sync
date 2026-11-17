import { TenantIsolationError, type TenantId } from '@rsd-sync/shared';

export function assertTenantIsolation(
  contextTenantId: TenantId,
  resourceTenantId: TenantId,
  resourceLabel = 'resource',
): void {
  if (contextTenantId !== resourceTenantId) {
    throw new TenantIsolationError(
      `Cross-tenant access denied for ${resourceLabel}`,
      {
        contextTenantId,
        resourceTenantId,
        resourceLabel,
      },
    );
  }
}
