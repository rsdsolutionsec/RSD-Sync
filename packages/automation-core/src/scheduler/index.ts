import type { TenantId } from '@rsd-sync/shared';

export interface ScheduledJobDefinition {
  readonly jobKey: string;
  readonly tenantId: TenantId;
  readonly cronExpression: string;
  readonly eventType: string;
  readonly enabled: boolean;
}

export interface SchedulerPort {
  registerSchedule(definition: ScheduledJobDefinition): Promise<void>;
  disableSchedule(tenantId: TenantId, jobKey: string): Promise<void>;
}
