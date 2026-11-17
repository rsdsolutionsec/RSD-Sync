import { parsePlatformConfig, type PlatformConfig } from '@rsd-sync/configuration';

export const ADMIN_MODULES = [
  'inbox',
  'contacts',
  'leads-and-opportunities',
  'approvals',
  'knowledge-base',
  'automations',
  'tenant-settings',
] as const;

export type AdminModule = (typeof ADMIN_MODULES)[number];

export interface AdminBootstrapInfo {
  readonly service: 'rsd-sync-admin';
  readonly phase: 'phase-1-operational-infra';
  readonly port: number;
  readonly usesGlobalAdminSecretInBrowser: false;
  readonly plannedUiPhase: 'phase-7';
  readonly modules: readonly AdminModule[];
}

export function getAdminBootstrapInfo(
  config: PlatformConfig = parsePlatformConfig(),
): AdminBootstrapInfo {
  return {
    service: 'rsd-sync-admin',
    phase: 'phase-1-operational-infra',
    port: config.ADMIN_PORT,
    usesGlobalAdminSecretInBrowser: false,
    plannedUiPhase: 'phase-7',
    modules: ADMIN_MODULES,
  };
}
