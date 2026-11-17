import { timingSafeEqual } from 'node:crypto';
import type { PlatformConfig } from '@rsd-sync/configuration';
import type { SupabaseConnector } from '@rsd-sync/database';
import { UnauthorizedOperationError } from '@rsd-sync/shared';
import type { FastifyRequest } from 'fastify';

function safeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export interface ApiAdminAuthContext {
  readonly method: 'supabase_jwt' | 'admin_api_key' | 'dev_open';
  readonly actor: string;
}

export async function authorizeAdminApiRequest(
  request: FastifyRequest,
  config: PlatformConfig,
  supabase: SupabaseConnector,
): Promise<ApiAdminAuthContext> {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.length > 0) {
      const user = await supabase.verifyAdminAccessToken(token);
      if (user) {
        return { method: 'supabase_jwt', actor: user.email };
      }
      throw new UnauthorizedOperationError('Invalid or unauthorized Supabase access token');
    }
  }

  const providedApiKey = request.headers['x-admin-api-key'];
  if (typeof providedApiKey === 'string' && config.ADMIN_API_KEY) {
    if (safeStringEqual(providedApiKey, config.ADMIN_API_KEY)) {
      return { method: 'admin_api_key', actor: 'admin-bff' };
    }
    throw new UnauthorizedOperationError('Invalid x-admin-api-key credential');
  }

  if (config.NODE_ENV === 'production' || config.ADMIN_API_KEY || supabase.isConfigured()) {
    throw new UnauthorizedOperationError(
      'Authentication required: provide a valid Bearer token or x-admin-api-key',
    );
  }

  return { method: 'dev_open', actor: 'local-dev-unconfigured' };
}
