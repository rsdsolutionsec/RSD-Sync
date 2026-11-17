import { parsePlatformConfig, type PlatformConfig } from '@rsd-sync/configuration';
import { API_MODULE_BOUNDARIES, type ApiModuleBoundary } from './modules/index.js';
import { getHealthEndpointDefinitions, type HealthRouteDefinition } from './routes/health.js';

export interface ApiBootstrapInfo {
  readonly service: 'rsd-sync-api';
  readonly phase: 'phase-0-foundation';
  readonly host: string;
  readonly port: number;
  readonly modules: readonly ApiModuleBoundary[];
  readonly healthRoutes: readonly HealthRouteDefinition[];
}

export function getApiBootstrapInfo(
  config: PlatformConfig = parsePlatformConfig(),
): ApiBootstrapInfo {
  return {
    service: 'rsd-sync-api',
    phase: 'phase-0-foundation',
    host: config.API_HOST,
    port: config.API_PORT,
    modules: API_MODULE_BOUNDARIES,
    healthRoutes: getHealthEndpointDefinitions(),
  };
}
