import type { TenantId, UserId } from '@rsd-sync/shared';

export interface AppointmentRecord {
  readonly appointmentId: string;
  readonly tenantId: TenantId;
  readonly contactId: string;
  readonly assignedUserId?: UserId | undefined;
  readonly scheduledFor: string;
  readonly status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  readonly notes?: string | undefined;
}
