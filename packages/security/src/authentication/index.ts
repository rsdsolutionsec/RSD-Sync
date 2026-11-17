import type { PlatformRole } from '@rsd-sync/contracts';
import type { TenantId, UserId } from '@rsd-sync/shared';

export interface AuthenticatedActor {
  readonly userId: UserId;
  readonly tenantId: TenantId;
  readonly role: PlatformRole;
}

export function createActorContext(actor: AuthenticatedActor): AuthenticatedActor {
  return Object.freeze({ ...actor });
}
