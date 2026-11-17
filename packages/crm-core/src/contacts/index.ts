import type { ChannelType } from '@rsd-sync/contracts';
import type { TenantId } from '@rsd-sync/shared';

export interface ContactRecord {
  readonly contactId: string;
  readonly tenantId: TenantId;
  readonly fullName: string;
  readonly phoneE164?: string | undefined;
  readonly email?: string | undefined;
  readonly primaryChannel: ChannelType;
  readonly externalReferenceId?: string | undefined;
  readonly createdAt: string;
}
