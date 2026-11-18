import { randomUUID } from 'node:crypto';
import type { TenantId } from '@rsd-sync/shared';
import type { DatabaseClient } from '../clients/index.js';

export type SupportedChannel = 'WHATSAPP' | 'WEB' | 'EMAIL' | 'API';
export type ConversationMode = 'AI' | 'HUMAN' | 'COPILOT';
export type AiProviderKind = 'openai' | 'anthropic' | 'gemini' | 'custom';
export type ApprovalRequestType =
  | 'PAYMENT'
  | 'SALE'
  | 'INVENTORY_RESERVATION'
  | 'ENROLLMENT'
  | 'HUMAN_HANDOFF';

export interface ActiveAiAgentRecord {
  readonly id: string;
  readonly name: string;
  readonly provider: AiProviderKind;
  readonly model: string;
  readonly systemPrompt: string;
  readonly dailyCostLimitUsd: number;
}

export interface KnowledgeDocumentRecord {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly content: string;
  readonly source: string;
}

export interface ConversationStateRecord {
  readonly conversationId: string;
  readonly contactId: string;
  readonly contactName: string;
  readonly phoneE164: string;
  readonly channel: SupportedChannel;
  readonly mode: ConversationMode;
  readonly aiPaused: boolean;
  readonly assignedUserId: string | null;
  readonly pauseReason: string | null;
  readonly lastMessageAt: string;
}

export interface ConversationSummaryRecord extends ConversationStateRecord {
  readonly lastMessagePreview: string | null;
  readonly pendingApprovalsCount: number;
}

export interface ConversationMessageRecord {
  readonly id: string;
  readonly conversationId: string;
  readonly direction: 'INBOUND' | 'OUTBOUND';
  readonly senderType: 'CUSTOMER' | 'AI' | 'HUMAN' | 'SYSTEM';
  readonly content: string;
  readonly externalMessageId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly sentAt: string;
}

export interface CommercialApprovalRecord {
  readonly id: string;
  readonly conversationId: string;
  readonly contactId: string;
  readonly requestType: ApprovalRequestType;
  readonly summary: string;
  readonly status: 'PENDING_VALIDATION' | 'APPROVED' | 'REJECTED';
  readonly externalSystem: string;
  readonly payload: Record<string, unknown>;
  readonly createdAt: string;
}

export class BotOperationsRepository {
  public constructor(private readonly db: DatabaseClient) {}

  public async resolveTenantByChannelAccount(
    channel: SupportedChannel,
    externalAccountId: string,
  ): Promise<TenantId | null> {
    const result = await this.db.query<{ tenant_id: string | null }>(
      'SELECT resolve_channel_tenant($1, $2) AS tenant_id',
      [channel, externalAccountId],
    );
    const tenantId = result.rows[0]?.tenant_id;
    return tenantId ? (tenantId as TenantId) : null;
  }

  public async resolveTenantBySlug(slug: string): Promise<TenantId | null> {
    const result = await this.db.query<{ tenant_id: string | null }>(
      'SELECT resolve_tenant_id_by_slug($1) AS tenant_id',
      [slug],
    );
    const tenantId = result.rows[0]?.tenant_id;
    return tenantId ? (tenantId as TenantId) : null;
  }

  public async ensureTenant(input: {
    readonly slug: string;
    readonly name: string;
  }): Promise<TenantId> {
    const existing = await this.resolveTenantBySlug(input.slug);
    if (existing) {
      return existing;
    }

    const tenantId = randomUUID() as TenantId;
    await this.db.withTenantTransaction(tenantId, async (tx) => {
      await tx.query(
        `INSERT INTO tenants (id, slug, name, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name`,
        [tenantId, input.slug, input.name],
      );
    });

    const resolved = await this.resolveTenantBySlug(input.slug);
    return resolved ?? tenantId;
  }

  public async upsertChannelConnection(
    tenantId: TenantId,
    input: {
      readonly channel: SupportedChannel;
      readonly externalAccountId: string;
      readonly displayName: string;
    },
  ): Promise<void> {
    await this.db.withTenantTransaction(tenantId, async (tx) => {
      await tx.query(
        `INSERT INTO channel_connections (tenant_id, channel, external_account_id, display_name, status)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT (channel, external_account_id)
         DO UPDATE SET display_name = EXCLUDED.display_name, status = 'active', updated_at = now()`,
        [tenantId, input.channel, input.externalAccountId, input.displayName],
      );
    });
  }

  public async upsertAiAgent(
    tenantId: TenantId,
    input: {
      readonly name: string;
      readonly provider: AiProviderKind;
      readonly model: string;
      readonly systemPrompt: string;
      readonly dailyCostLimitUsd?: number;
    },
  ): Promise<void> {
    await this.db.withTenantTransaction(tenantId, async (tx) => {
      await tx.query(
        `INSERT INTO ai_agents (tenant_id, name, provider, model, system_prompt, daily_cost_limit_usd, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (tenant_id, name)
         DO UPDATE SET
           provider = EXCLUDED.provider,
           model = EXCLUDED.model,
           system_prompt = EXCLUDED.system_prompt,
           daily_cost_limit_usd = EXCLUDED.daily_cost_limit_usd,
           is_active = true,
           updated_at = now()`,
        [
          tenantId,
          input.name,
          input.provider,
          input.model,
          input.systemPrompt,
          input.dailyCostLimitUsd ?? 10,
        ],
      );
    });
  }

  public async upsertKnowledgeDocument(
    tenantId: TenantId,
    input: {
      readonly title: string;
      readonly category: string;
      readonly content: string;
      readonly source: string;
    },
  ): Promise<void> {
    await this.db.withTenantTransaction(tenantId, async (tx) => {
      await tx.query(
        `INSERT INTO knowledge_documents (tenant_id, title, category, content, source, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (tenant_id, title)
         DO UPDATE SET
           category = EXCLUDED.category,
           content = EXCLUDED.content,
           source = EXCLUDED.source,
           is_active = true,
           updated_at = now()`,
        [tenantId, input.title, input.category, input.content, input.source],
      );
    });
  }

  public async tryRegisterInboundExecution(
    tenantId: TenantId,
    input: {
      readonly correlationId: string;
      readonly idempotencyKey: string;
      readonly eventType: string;
    },
  ): Promise<{ readonly isDuplicate: boolean; readonly executionId: string | null }> {
    return this.db.withTenantTransaction(tenantId, async (tx) => {
      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO automation_executions (tenant_id, correlation_id, idempotency_key, event_type, status, attempts)
         VALUES ($1, $2, $3, $4, 'PENDING', 0)
         ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
         RETURNING id`,
        [tenantId, input.correlationId, input.idempotencyKey, input.eventType],
      );

      if (inserted.rows.length === 0) {
        return { isDuplicate: true, executionId: null };
      }

      return { isDuplicate: false, executionId: inserted.rows[0]?.id ?? null };
    });
  }

  public async updateExecutionStatus(
    tenantId: TenantId,
    input: {
      readonly idempotencyKey: string;
      readonly status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER' | 'CANCELLED';
      readonly incrementAttempt?: boolean;
      readonly lastError?: string | null;
    },
  ): Promise<void> {
    await this.db.withTenantTransaction(tenantId, async (tx) => {
      await tx.query(
        `UPDATE automation_executions
         SET status = $2,
             attempts = attempts + $3,
             last_error = COALESCE($4, last_error),
             updated_at = now()
         WHERE tenant_id = $1 AND idempotency_key = $5`,
        [
          tenantId,
          input.status,
          input.incrementAttempt ? 1 : 0,
          input.lastError ?? null,
          input.idempotencyKey,
        ],
      );
    });
  }

  public async upsertContactAndConversation(
    tenantId: TenantId,
    input: {
      readonly phoneE164: string;
      readonly fullName: string;
      readonly channel: SupportedChannel;
    },
  ): Promise<ConversationStateRecord> {
    return this.db.withTenantTransaction(tenantId, async (tx) => {
      const contactRes = await tx.query<{ id: string; full_name: string; phone_e164: string }>(
        `INSERT INTO contacts (tenant_id, full_name, phone_e164, primary_channel)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, phone_e164)
         DO UPDATE SET
           full_name = CASE
             WHEN length(trim(EXCLUDED.full_name)) > 0 THEN EXCLUDED.full_name
             ELSE contacts.full_name
           END,
           updated_at = now()
         RETURNING id, full_name, phone_e164`,
        [tenantId, input.fullName, input.phoneE164, input.channel],
      );

      const contact = contactRes.rows[0];
      if (!contact) {
        throw new Error('Failed to upsert contact.');
      }

      const convRes = await tx.query<{
        id: string;
        channel: SupportedChannel;
        mode: ConversationMode;
        ai_paused: boolean;
        assigned_user_id: string | null;
        pause_reason: string | null;
        last_message_at: string;
      }>(
        `INSERT INTO conversations (tenant_id, contact_id, channel)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, contact_id, channel)
         DO UPDATE SET last_message_at = now(), updated_at = now()
         RETURNING id, channel, mode, ai_paused, assigned_user_id, pause_reason, last_message_at::text`,
        [tenantId, contact.id, input.channel],
      );

      const conv = convRes.rows[0];
      if (!conv) {
        throw new Error('Failed to upsert conversation.');
      }

      return {
        conversationId: conv.id,
        contactId: contact.id,
        contactName: contact.full_name,
        phoneE164: contact.phone_e164,
        channel: conv.channel,
        mode: conv.mode,
        aiPaused: conv.ai_paused,
        assignedUserId: conv.assigned_user_id,
        pauseReason: conv.pause_reason,
        lastMessageAt: conv.last_message_at,
      };
    });
  }

  public async recordMessage(
    tenantId: TenantId,
    input: {
      readonly conversationId: string;
      readonly channel: SupportedChannel;
      readonly direction: 'INBOUND' | 'OUTBOUND';
      readonly senderType: 'CUSTOMER' | 'AI' | 'HUMAN' | 'SYSTEM';
      readonly content: string;
      readonly externalMessageId?: string | null;
      readonly metadata?: Record<string, unknown>;
    },
  ): Promise<{ readonly inserted: boolean; readonly messageId: string | null }> {
    return this.db.withTenantTransaction(tenantId, async (tx) => {
      const insertSql = input.externalMessageId
        ? `INSERT INTO messages (
             tenant_id, conversation_id, channel, direction, sender_type, content, external_message_id, metadata
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
           ON CONFLICT (tenant_id, external_message_id) WHERE external_message_id IS NOT NULL DO NOTHING
           RETURNING id`
        : `INSERT INTO messages (
             tenant_id, conversation_id, channel, direction, sender_type, content, external_message_id, metadata
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
           RETURNING id`;

      const res = await tx.query<{ id: string }>(insertSql, [
        tenantId,
        input.conversationId,
        input.channel,
        input.direction,
        input.senderType,
        input.content,
        input.externalMessageId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ]);

      if (res.rows.length === 0) {
        return { inserted: false, messageId: null };
      }

      await tx.query(
        `UPDATE conversations
         SET last_message_at = now(), updated_at = now()
         WHERE tenant_id = $1 AND id = $2`,
        [tenantId, input.conversationId],
      );

      return { inserted: true, messageId: res.rows[0]?.id ?? null };
    });
  }

  public async getAiContext(
    tenantId: TenantId,
    conversationId: string,
    historyLimit = 12,
  ): Promise<{
    readonly agent: ActiveAiAgentRecord | null;
    readonly knowledgeDocuments: readonly KnowledgeDocumentRecord[];
    readonly recentMessages: readonly ConversationMessageRecord[];
    readonly conversation: ConversationStateRecord | null;
  }> {
    return this.db.withTenantTransaction(tenantId, async (tx) => {
      const agentRes = await tx.query<{
        id: string;
        name: string;
        provider: AiProviderKind;
        model: string;
        system_prompt: string;
        daily_cost_limit_usd: string;
      }>(
        `SELECT id, name, provider, model, system_prompt, daily_cost_limit_usd::text
         FROM ai_agents
         WHERE tenant_id = $1 AND is_active = true
         ORDER BY updated_at DESC
         LIMIT 1`,
        [tenantId],
      );

      const docsRes = await tx.query<{
        id: string;
        title: string;
        category: string;
        content: string;
        source: string;
      }>(
        `SELECT id, title, category, content, source
         FROM knowledge_documents
         WHERE tenant_id = $1 AND is_active = true
         ORDER BY title ASC`,
        [tenantId],
      );

      const convRes = await tx.query<{
        conversation_id: string;
        contact_id: string;
        full_name: string;
        phone_e164: string;
        channel: SupportedChannel;
        mode: ConversationMode;
        ai_paused: boolean;
        assigned_user_id: string | null;
        pause_reason: string | null;
        last_message_at: string;
      }>(
        `SELECT c.id AS conversation_id, c.contact_id, ct.full_name, ct.phone_e164,
                c.channel, c.mode, c.ai_paused, c.assigned_user_id, c.pause_reason,
                c.last_message_at::text
         FROM conversations c
         JOIN contacts ct ON ct.id = c.contact_id
         WHERE c.tenant_id = $1 AND c.id = $2
         LIMIT 1`,
        [tenantId, conversationId],
      );

      const msgRes = await tx.query<{
        id: string;
        conversation_id: string;
        direction: 'INBOUND' | 'OUTBOUND';
        sender_type: 'CUSTOMER' | 'AI' | 'HUMAN' | 'SYSTEM';
        content: string;
        external_message_id: string | null;
        metadata: Record<string, unknown>;
        sent_at: string;
      }>(
        `SELECT id, conversation_id, direction, sender_type, content, external_message_id, metadata, sent_at::text
         FROM (
           SELECT id, conversation_id, direction, sender_type, content, external_message_id, metadata, sent_at
           FROM messages
           WHERE tenant_id = $1 AND conversation_id = $2
           ORDER BY sent_at DESC
           LIMIT $3
         ) sub
         ORDER BY sent_at ASC`,
        [tenantId, conversationId, historyLimit],
      );

      const agentRow = agentRes.rows[0];
      const convRow = convRes.rows[0];

      return {
        agent: agentRow
          ? {
              id: agentRow.id,
              name: agentRow.name,
              provider: agentRow.provider,
              model: agentRow.model,
              systemPrompt: agentRow.system_prompt,
              dailyCostLimitUsd: Number(agentRow.daily_cost_limit_usd),
            }
          : null,
        knowledgeDocuments: docsRes.rows,
        conversation: convRow
          ? {
              conversationId: convRow.conversation_id,
              contactId: convRow.contact_id,
              contactName: convRow.full_name,
              phoneE164: convRow.phone_e164,
              channel: convRow.channel,
              mode: convRow.mode,
              aiPaused: convRow.ai_paused,
              assignedUserId: convRow.assigned_user_id,
              pauseReason: convRow.pause_reason,
              lastMessageAt: convRow.last_message_at,
            }
          : null,
        recentMessages: msgRes.rows.map((row) => ({
          id: row.id,
          conversationId: row.conversation_id,
          direction: row.direction,
          senderType: row.sender_type,
          content: row.content,
          externalMessageId: row.external_message_id,
          metadata: row.metadata ?? {},
          sentAt: row.sent_at,
        })),
      };
    });
  }

  public async updateConversationMode(
    tenantId: TenantId,
    conversationId: string,
    input: {
      readonly mode: ConversationMode;
      readonly aiPaused: boolean;
      readonly assignedUserId: string | null;
      readonly pauseReason: string | null;
      readonly actorId: string;
      readonly actorRole?: string;
      readonly correlationId?: string;
    },
  ): Promise<ConversationStateRecord | null> {
    return this.db.withTenantTransaction(tenantId, async (tx) => {
      const updated = await tx.query<{
        id: string;
        contact_id: string;
        channel: SupportedChannel;
        mode: ConversationMode;
        ai_paused: boolean;
        assigned_user_id: string | null;
        pause_reason: string | null;
        last_message_at: string;
      }>(
        `UPDATE conversations
         SET mode = $3,
             ai_paused = $4,
             assigned_user_id = $5,
             pause_reason = $6,
             updated_at = now()
         WHERE tenant_id = $1 AND id = $2
         RETURNING id, contact_id, channel, mode, ai_paused, assigned_user_id, pause_reason, last_message_at::text`,
        [
          tenantId,
          conversationId,
          input.mode,
          input.aiPaused,
          input.assignedUserId,
          input.pauseReason,
        ],
      );

      const conv = updated.rows[0];
      if (!conv) {
        return null;
      }

      const contactRes = await tx.query<{ full_name: string; phone_e164: string }>(
        `SELECT full_name, phone_e164 FROM contacts WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        [tenantId, conv.contact_id],
      );

      await tx.query(
        `INSERT INTO audit_logs (
           tenant_id, actor_id, actor_role, action, resource_type, resource_id, correlation_id, metadata
         )
         VALUES ($1, $2, $3, 'conversation.mode_changed', 'conversation', $4, $5, $6::jsonb)`,
        [
          tenantId,
          input.actorId,
          input.actorRole ?? 'OPERATOR',
          conversationId,
          input.correlationId ?? randomUUID(),
          JSON.stringify({
            mode: input.mode,
            aiPaused: input.aiPaused,
            assignedUserId: input.assignedUserId,
            pauseReason: input.pauseReason,
          }),
        ],
      );

      return {
        conversationId: conv.id,
        contactId: conv.contact_id,
        contactName: contactRes.rows[0]?.full_name ?? '',
        phoneE164: contactRes.rows[0]?.phone_e164 ?? '',
        channel: conv.channel,
        mode: conv.mode,
        aiPaused: conv.ai_paused,
        assignedUserId: conv.assigned_user_id,
        pauseReason: conv.pause_reason,
        lastMessageAt: conv.last_message_at,
      };
    });
  }

  public async createCommercialApproval(
    tenantId: TenantId,
    input: {
      readonly conversationId: string;
      readonly contactId: string;
      readonly requestType: ApprovalRequestType;
      readonly summary: string;
      readonly externalSystem: string;
      readonly payload?: Record<string, unknown>;
    },
  ): Promise<CommercialApprovalRecord> {
    return this.db.withTenantTransaction(tenantId, async (tx) => {
      const inserted = await tx.query<{
        id: string;
        conversation_id: string;
        contact_id: string;
        request_type: ApprovalRequestType;
        summary: string;
        status: 'PENDING_VALIDATION' | 'APPROVED' | 'REJECTED';
        external_system: string;
        payload: Record<string, unknown>;
        created_at: string;
      }>(
        `INSERT INTO commercial_approvals (
           tenant_id, conversation_id, contact_id, request_type, summary, status, external_system, payload
         )
         VALUES ($1, $2, $3, $4, $5, 'PENDING_VALIDATION', $6, $7::jsonb)
         RETURNING id, conversation_id, contact_id, request_type, summary, status, external_system, payload, created_at::text`,
        [
          tenantId,
          input.conversationId,
          input.contactId,
          input.requestType,
          input.summary,
          input.externalSystem,
          JSON.stringify(input.payload ?? {}),
        ],
      );

      const row = inserted.rows[0];
      if (!row) {
        throw new Error('Failed to create commercial approval record.');
      }

      return {
        id: row.id,
        conversationId: row.conversation_id,
        contactId: row.contact_id,
        requestType: row.request_type,
        summary: row.summary,
        status: row.status,
        externalSystem: row.external_system,
        payload: row.payload ?? {},
        createdAt: row.created_at,
      };
    });
  }

  public async listConversations(
    tenantId: TenantId,
    limit = 50,
  ): Promise<readonly ConversationSummaryRecord[]> {
    return this.db.withTenantTransaction(tenantId, async (tx) => {
      const res = await tx.query<{
        conversation_id: string;
        contact_id: string;
        full_name: string;
        phone_e164: string;
        channel: SupportedChannel;
        mode: ConversationMode;
        ai_paused: boolean;
        assigned_user_id: string | null;
        pause_reason: string | null;
        last_message_at: string;
        last_message_preview: string | null;
        pending_approvals_count: string;
      }>(
        `SELECT c.id AS conversation_id,
                c.contact_id,
                ct.full_name,
                ct.phone_e164,
                c.channel,
                c.mode,
                c.ai_paused,
                c.assigned_user_id,
                c.pause_reason,
                c.last_message_at::text,
                (
                  SELECT m.content
                  FROM messages m
                  WHERE m.tenant_id = $1 AND m.conversation_id = c.id
                  ORDER BY m.sent_at DESC
                  LIMIT 1
                ) AS last_message_preview,
                (
                  SELECT count(*)::text
                  FROM commercial_approvals ca
                  WHERE ca.tenant_id = $1 AND ca.conversation_id = c.id AND ca.status = 'PENDING_VALIDATION'
                ) AS pending_approvals_count
         FROM conversations c
         JOIN contacts ct ON ct.id = c.contact_id
         WHERE c.tenant_id = $1
         ORDER BY c.last_message_at DESC
         LIMIT $2`,
        [tenantId, limit],
      );

      return res.rows.map((row) => ({
        conversationId: row.conversation_id,
        contactId: row.contact_id,
        contactName: row.full_name,
        phoneE164: row.phone_e164,
        channel: row.channel,
        mode: row.mode,
        aiPaused: row.ai_paused,
        assignedUserId: row.assigned_user_id,
        pauseReason: row.pause_reason,
        lastMessageAt: row.last_message_at,
        lastMessagePreview: row.last_message_preview,
        pendingApprovalsCount: Number(row.pending_approvals_count ?? '0'),
      }));
    });
  }

  public async getConversationDetail(
    tenantId: TenantId,
    conversationId: string,
  ): Promise<{
    readonly conversation: ConversationStateRecord;
    readonly messages: readonly ConversationMessageRecord[];
    readonly approvals: readonly CommercialApprovalRecord[];
  } | null> {
    return this.db.withTenantTransaction(tenantId, async (tx) => {
      const convRes = await tx.query<{
        conversation_id: string;
        contact_id: string;
        full_name: string;
        phone_e164: string;
        channel: SupportedChannel;
        mode: ConversationMode;
        ai_paused: boolean;
        assigned_user_id: string | null;
        pause_reason: string | null;
        last_message_at: string;
      }>(
        `SELECT c.id AS conversation_id,
                c.contact_id,
                ct.full_name,
                ct.phone_e164,
                c.channel,
                c.mode,
                c.ai_paused,
                c.assigned_user_id,
                c.pause_reason,
                c.last_message_at::text
         FROM conversations c
         JOIN contacts ct ON ct.id = c.contact_id
         WHERE c.tenant_id = $1 AND c.id = $2
         LIMIT 1`,
        [tenantId, conversationId],
      );

      const convRow = convRes.rows[0];
      if (!convRow) {
        return null;
      }

      const msgRes = await tx.query<{
        id: string;
        conversation_id: string;
        direction: 'INBOUND' | 'OUTBOUND';
        sender_type: 'CUSTOMER' | 'AI' | 'HUMAN' | 'SYSTEM';
        content: string;
        external_message_id: string | null;
        metadata: Record<string, unknown>;
        sent_at: string;
      }>(
        `SELECT id, conversation_id, direction, sender_type, content, external_message_id, metadata, sent_at::text
         FROM messages
         WHERE tenant_id = $1 AND conversation_id = $2
         ORDER BY sent_at ASC`,
        [tenantId, conversationId],
      );

      const appRes = await tx.query<{
        id: string;
        conversation_id: string;
        contact_id: string;
        request_type: ApprovalRequestType;
        summary: string;
        status: 'PENDING_VALIDATION' | 'APPROVED' | 'REJECTED';
        external_system: string;
        payload: Record<string, unknown>;
        created_at: string;
      }>(
        `SELECT id, conversation_id, contact_id, request_type, summary, status, external_system, payload, created_at::text
         FROM commercial_approvals
         WHERE tenant_id = $1 AND conversation_id = $2
         ORDER BY created_at DESC`,
        [tenantId, conversationId],
      );

      return {
        conversation: {
          conversationId: convRow.conversation_id,
          contactId: convRow.contact_id,
          contactName: convRow.full_name,
          phoneE164: convRow.phone_e164,
          channel: convRow.channel,
          mode: convRow.mode,
          aiPaused: convRow.ai_paused,
          assignedUserId: convRow.assigned_user_id,
          pauseReason: convRow.pause_reason,
          lastMessageAt: convRow.last_message_at,
        },
        messages: msgRes.rows.map((row) => ({
          id: row.id,
          conversationId: row.conversation_id,
          direction: row.direction,
          senderType: row.sender_type,
          content: row.content,
          externalMessageId: row.external_message_id,
          metadata: row.metadata ?? {},
          sentAt: row.sent_at,
        })),
        approvals: appRes.rows.map((row) => ({
          id: row.id,
          conversationId: row.conversation_id,
          contactId: row.contact_id,
          requestType: row.request_type,
          summary: row.summary,
          status: row.status,
          externalSystem: row.external_system,
          payload: row.payload ?? {},
          createdAt: row.created_at,
        })),
      };
    });
  }
}
