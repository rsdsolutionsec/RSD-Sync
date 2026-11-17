export interface HealthRouteDefinition {
  readonly method: 'GET';
  readonly path: string;
  readonly purpose: string;
}

export function getHealthEndpointDefinitions(): readonly HealthRouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/health/live',
      purpose: 'Liveness probe confirming API process responsiveness',
    },
    {
      method: 'GET',
      path: '/health/ready',
      purpose: 'Readiness probe verifying Redis and PostgreSQL connectivity (Phase 1+)',
    },
  ];
}
