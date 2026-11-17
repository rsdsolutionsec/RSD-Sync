export const TENANT_HEADER_NAME = 'x-tenant-id';
export const CORRELATION_HEADER_NAME = 'x-correlation-id';

export interface ApiRequestBoundaryHeaders {
  readonly tenantHeader: string;
  readonly correlationHeader: string;
}

export function getApiBoundaryHeaderNames(): ApiRequestBoundaryHeaders {
  return {
    tenantHeader: TENANT_HEADER_NAME,
    correlationHeader: CORRELATION_HEADER_NAME,
  };
}
