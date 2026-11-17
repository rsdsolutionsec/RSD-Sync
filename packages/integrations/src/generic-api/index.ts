import type { TenantId } from '@rsd-sync/shared';

export interface GenericApiRequest {
  readonly tenantId: TenantId;
  readonly integrationKey: string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  readonly path: string;
  readonly body?: Record<string, unknown> | undefined;
}

export interface GenericApiResponse {
  readonly statusCode: number;
  readonly data: unknown;
}

export interface GenericApiAdapterPort {
  execute(request: GenericApiRequest): Promise<GenericApiResponse>;
}
