import type { TenantId } from '@rsd-sync/shared';

export type OpportunityStage =
  | 'DISCOVERY'
  | 'PROPOSAL'
  | 'PENDING_VALIDATION'
  | 'WON'
  | 'LOST';

export interface OpportunityRecord {
  readonly opportunityId: string;
  readonly tenantId: TenantId;
  readonly leadId: string;
  readonly title: string;
  readonly stage: OpportunityStage;
  readonly estimatedAmount?: number | undefined;
  readonly currency?: string | undefined;
}
