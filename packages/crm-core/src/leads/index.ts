import type { TenantId, UserId } from '@rsd-sync/shared';

export type LeadStatus = 'NEW' | 'QUALIFYING' | 'QUALIFIED' | 'CONVERTED' | 'LOST';

export interface LeadRecord {
  readonly leadId: string;
  readonly tenantId: TenantId;
  readonly contactId: string;
  readonly sourceChannel: string;
  readonly status: LeadStatus;
  readonly ownerUserId?: UserId | undefined;
  readonly notes?: string | undefined;
  readonly createdAt: string;
}
