import type { PlatformRole, TenantLimits } from '@rsd-sync/contracts';
import type { CorrelationId, TenantId } from '@rsd-sync/shared';

export const DATABASE_TABLES = {
  TENANTS: 'tenants',
  AUDIT_LOGS: 'audit_logs',
  CHANNEL_CONNECTIONS: 'channel_connections',
  AI_AGENTS: 'ai_agents',
  KNOWLEDGE_DOCUMENTS: 'knowledge_documents',
  CONTACTS: 'contacts',
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  AUTOMATION_EXECUTIONS: 'automation_executions',
  COMMERCIAL_APPROVALS: 'commercial_approvals',
} as const;

export interface TenantRow {
  readonly id: TenantId;
  readonly slug: string;
  readonly name: string;
  readonly status: 'active' | 'suspended';
  readonly limits: TenantLimits;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuditLogRow {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly actorId: string;
  readonly actorRole: PlatformRole;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly correlationId: CorrelationId;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}
