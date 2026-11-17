import type { PlatformRole } from '@rsd-sync/contracts';
import { UnauthorizedOperationError } from '@rsd-sync/shared';

export type PlatformAction =
  | 'tenant:manage'
  | 'secrets:manage'
  | 'users:manage'
  | 'automations:manage'
  | 'knowledge:manage'
  | 'conversations:read'
  | 'conversations:takeover'
  | 'conversations:reply_human'
  | 'conversations:reply_ai'
  | 'approvals:decide'
  | 'tools:read_only'
  | 'tools:request_commercial';

const ROLE_PERMISSIONS: Readonly<Record<PlatformRole, ReadonlySet<PlatformAction>>> = {
  SUPER_ADMIN: new Set<PlatformAction>([
    'tenant:manage',
    'secrets:manage',
    'users:manage',
    'automations:manage',
    'knowledge:manage',
    'conversations:read',
    'conversations:takeover',
    'conversations:reply_human',
    'approvals:decide',
    'tools:read_only',
    'tools:request_commercial',
  ]),
  TENANT_ADMIN: new Set<PlatformAction>([
    'secrets:manage',
    'users:manage',
    'automations:manage',
    'knowledge:manage',
    'conversations:read',
    'conversations:takeover',
    'conversations:reply_human',
    'approvals:decide',
    'tools:read_only',
    'tools:request_commercial',
  ]),
  OPERATOR: new Set<PlatformAction>([
    'automations:manage',
    'knowledge:manage',
    'conversations:read',
    'conversations:takeover',
    'conversations:reply_human',
    'approvals:decide',
    'tools:read_only',
    'tools:request_commercial',
  ]),
  SECRETARY: new Set<PlatformAction>([
    'conversations:read',
    'conversations:takeover',
    'conversations:reply_human',
    'approvals:decide',
    'tools:read_only',
    'tools:request_commercial',
  ]),
  AI_AGENT: new Set<PlatformAction>([
    'conversations:read',
    'conversations:reply_ai',
    'tools:read_only',
    'tools:request_commercial',
  ]),
};

export function canExecuteAction(role: PlatformRole, action: PlatformAction): boolean {
  return ROLE_PERMISSIONS[role].has(action);
}

export function assertCanExecuteAction(role: PlatformRole, action: PlatformAction): void {
  if (!canExecuteAction(role, action)) {
    throw new UnauthorizedOperationError(
      `Role ${role} is not authorized to perform ${action}`,
      { role, action },
    );
  }
}
