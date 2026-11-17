import type { TenantId, UserId } from '@rsd-sync/shared';

export interface ConversationAssignment {
  readonly assignmentId: string;
  readonly tenantId: TenantId;
  readonly conversationId: string;
  readonly assigneeUserId: UserId;
  readonly assignedByUserId: UserId;
  readonly assignedAt: string;
}
