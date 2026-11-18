import { randomUUID } from 'node:crypto';
import type { PlatformConfig } from '@rsd-sync/configuration';
import { transitionConversationMode } from '@rsd-sync/crm-core';
import { BotOperationsRepository, type PostgresDatabaseClient, type SupabaseConnector } from '@rsd-sync/database';
import {
  enqueueWhatsappOutboundJob,
  type WhatsappOutboundJobPayload,
  type WhatsappOutboundJobResult,
} from '@rsd-sync/queue';
import { asUserId, RsdError, ValidationError } from '@rsd-sync/shared';
import type { Queue } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authorizeAdminApiRequest } from '../middleware/admin-auth.js';

const TenantQuerySchema = z.object({
  tenantSlug: z.string().trim().min(1).max(60).optional(),
});

const ConversationParamsSchema = z.object({
  conversationId: z.string().uuid(),
});

const UpdateModeBodySchema = z.object({
  mode: z.enum(['AI', 'HUMAN', 'COPILOT']),
  reason: z.string().trim().max(300).optional(),
});

const HumanReplyBodySchema = z.object({
  textBody: z.string().trim().min(1).max(4000),
});

export interface ConversationRoutesDeps {
  readonly config: PlatformConfig;
  readonly database: PostgresDatabaseClient;
  readonly supabase: SupabaseConnector;
  readonly whatsappOutboundQueue: Queue<WhatsappOutboundJobPayload, WhatsappOutboundJobResult>;
}

export function registerConversationRoutes(
  app: FastifyInstance,
  deps: ConversationRoutesDeps,
): void {
  const botRepo = new BotOperationsRepository(deps.database);

  async function resolveTenantIdFromQuery(query: unknown) {
    const parsedQuery = TenantQuerySchema.safeParse(query ?? {});
    const requestedSlug = parsedQuery.success ? parsedQuery.data.tenantSlug : undefined;

    if (requestedSlug) {
      const tenantId = await botRepo.resolveTenantBySlug(requestedSlug);
      if (!tenantId) {
        throw new RsdError(
          'TENANT_NOT_FOUND',
          `Tenant "${requestedSlug}" is not provisioned yet.`,
          404,
        );
      }
      return { tenantId, tenantSlug: requestedSlug };
    }

    const phoneNumberId = deps.config.WHATSAPP_PHONE_NUMBER_ID;
    if (phoneNumberId) {
      const tenantId = await botRepo.resolveTenantByChannelAccount('WHATSAPP', phoneNumberId);
      if (tenantId) {
        return { tenantId, tenantSlug: 'active-channel' };
      }
    }

    throw new RsdError(
      'TENANT_NOT_FOUND',
      'No active tenant found for the configured WhatsApp channel. Provision a tenant first.',
      404,
    );
  }

  app.get('/api/v1/conversations', async (request) => {
    await authorizeAdminApiRequest(request, deps.config, deps.supabase);
    const { tenantId, tenantSlug } = await resolveTenantIdFromQuery(request.query);
    const conversations = await botRepo.listConversations(tenantId, 50);
    return {
      tenantId,
      tenantSlug,
      conversations,
    };
  });

  app.get('/api/v1/conversations/:conversationId/messages', async (request) => {
    await authorizeAdminApiRequest(request, deps.config, deps.supabase);
    const params = ConversationParamsSchema.safeParse(request.params);
    if (!params.success) {
      throw new ValidationError('Invalid conversationId parameter');
    }

    const { tenantId } = await resolveTenantIdFromQuery(request.query);
    const detail = await botRepo.getConversationDetail(tenantId, params.data.conversationId);
    if (!detail) {
      throw new RsdError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    return detail;
  });

  app.post('/api/v1/conversations/:conversationId/mode', async (request) => {
    const auth = await authorizeAdminApiRequest(request, deps.config, deps.supabase);
    const params = ConversationParamsSchema.safeParse(request.params);
    if (!params.success) {
      throw new ValidationError('Invalid conversationId parameter');
    }

    const body = UpdateModeBodySchema.safeParse(request.body ?? {});
    if (!body.success) {
      throw new ValidationError('Invalid mode transition body', {
        issues: body.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const { tenantId } = await resolveTenantIdFromQuery(request.query);
    const detail = await botRepo.getConversationDetail(tenantId, params.data.conversationId);
    if (!detail) {
      throw new RsdError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    const nextState = transitionConversationMode(
      {
        conversationId: detail.conversation.conversationId,
        tenantId,
        contactId: detail.conversation.contactId,
        channel: detail.conversation.channel,
        mode: detail.conversation.mode,
        aiPaused: detail.conversation.aiPaused,
        assignedUserId: detail.conversation.assignedUserId
          ? asUserId(detail.conversation.assignedUserId)
          : undefined,
        pauseReason: detail.conversation.pauseReason ?? undefined,
        updatedAt: detail.conversation.lastMessageAt,
      },
      {
        nextMode: body.data.mode,
        actorId: asUserId(auth.actor),
        actorRole: 'TENANT_ADMIN',
        reason: body.data.reason,
      },
    );

    const updated = await botRepo.updateConversationMode(tenantId, params.data.conversationId, {
      mode: nextState.mode,
      aiPaused: nextState.aiPaused,
      assignedUserId: nextState.assignedUserId ?? null,
      pauseReason: nextState.pauseReason ?? null,
      actorId: auth.actor,
      actorRole: 'TENANT_ADMIN',
      correlationId: request.id,
    });

    return { conversation: updated };
  });

  app.post('/api/v1/conversations/:conversationId/reply', async (request, reply) => {
    const auth = await authorizeAdminApiRequest(request, deps.config, deps.supabase);
    const params = ConversationParamsSchema.safeParse(request.params);
    if (!params.success) {
      throw new ValidationError('Invalid conversationId parameter');
    }

    const body = HumanReplyBodySchema.safeParse(request.body ?? {});
    if (!body.success) {
      throw new ValidationError('Invalid reply payload');
    }

    const { tenantId } = await resolveTenantIdFromQuery(request.query);
    const detail = await botRepo.getConversationDetail(tenantId, params.data.conversationId);
    if (!detail) {
      throw new RsdError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    // Human intervention enforces automatic AI pause (mode = HUMAN, aiPaused = true).
    const nextState = transitionConversationMode(
      {
        conversationId: detail.conversation.conversationId,
        tenantId,
        contactId: detail.conversation.contactId,
        channel: detail.conversation.channel,
        mode: detail.conversation.mode,
        aiPaused: detail.conversation.aiPaused,
        assignedUserId: detail.conversation.assignedUserId
          ? asUserId(detail.conversation.assignedUserId)
          : undefined,
        pauseReason: detail.conversation.pauseReason ?? undefined,
        updatedAt: detail.conversation.lastMessageAt,
      },
      {
        nextMode: 'HUMAN',
        actorId: asUserId(auth.actor),
        actorRole: 'OPERATOR',
        reason: 'Manual reply from admin panel',
      },
    );

    const updatedConversation = await botRepo.updateConversationMode(
      tenantId,
      params.data.conversationId,
      {
        mode: nextState.mode,
        aiPaused: nextState.aiPaused,
        assignedUserId: nextState.assignedUserId ?? null,
        pauseReason: nextState.pauseReason ?? null,
        actorId: auth.actor,
        actorRole: 'OPERATOR',
        correlationId: request.id,
      },
    );

    const job = await enqueueWhatsappOutboundJob(deps.whatsappOutboundQueue, {
      tenantId,
      correlationId: request.id,
      idempotencyKey: `human-reply:${params.data.conversationId}:${randomUUID()}`,
      conversationId: params.data.conversationId,
      phoneNumberId: deps.config.WHATSAPP_PHONE_NUMBER_ID ?? 'local-sumak-phone-id',
      toPhoneE164: detail.conversation.phoneE164,
      textBody: body.data.textBody,
      senderType: 'HUMAN',
      deliveryMode: deps.config.WHATSAPP_DELIVERY_MODE,
      metadata: {
        actor: auth.actor,
      },
    });

    return reply.status(202).send({
      accepted: true,
      conversation: updatedConversation,
      jobId: String(job.id ?? ''),
    });
  });
}
