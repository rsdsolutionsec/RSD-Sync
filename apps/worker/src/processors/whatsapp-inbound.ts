import {
  GeminiAiModelProvider,
  selectRelevantKnowledgeSnippets,
  trimConversationContext,
  type AiMessage,
  type AiModelProvider,
} from '@rsd-sync/ai-engine';
import type { PlatformConfig } from '@rsd-sync/configuration';
import { shouldAiAutoReply, transitionConversationMode } from '@rsd-sync/crm-core';
import {
  BotOperationsRepository,
  type ApprovalRequestType,
  type PostgresDatabaseClient,
} from '@rsd-sync/database';
import type { StructuredLogger } from '@rsd-sync/observability';
import {
  enqueueWhatsappOutboundJob,
  type WhatsappInboundJobPayload,
  type WhatsappInboundJobResult,
  type WhatsappOutboundJobPayload,
  type WhatsappOutboundJobResult,
} from '@rsd-sync/queue';
import { asTenantId, asUserId } from '@rsd-sync/shared';
import type { Job, Queue } from 'bullmq';

interface DetectedApprovalIntent {
  readonly requestType: ApprovalRequestType;
  readonly reason: string;
  readonly acknowledgement: string;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function detectApprovalOrHandoffIntent(textBody: string): DetectedApprovalIntent | null {
  const normalized = normalizeText(textBody);

  if (
    /(comprobante|voucher|transferencia|deposito|ya pague|ya realice el pago|confirmar pago|adjunto pago|imagen adjunta)/.test(
      normalized,
    )
  ) {
    return {
      requestType: 'PAYMENT',
      reason: 'Reporte o consulta de comprobante de pago (requiere validacion externa)',
      acknowledgement:
        'Hemos recibido tu aviso/comprobante de pago. Por seguridad operativa no confirmamos pagos automáticamente por chat: tu solicitud quedó registrada como PENDIENTE DE VALIDACIÓN y una asesora/secretaria la revisará en breve.',
    };
  }

  if (
    /(quiero comprar|hacer un pedido|hacer pedido|realizar compra|confirmar compra|solicito pack|comprar el pack|quiero el pack)/.test(
      normalized,
    )
  ) {
    return {
      requestType: 'SALE',
      reason: 'Solicitud comercial de compra o pedido (requiere validacion de stock y pago)',
      acknowledgement:
        '¡Gracias por tu interés! Tu solicitud de pedido quedó registrada como PENDIENTE DE VALIDACIÓN para verificar disponibilidad y continuar el proceso con una asesora/secretaria.',
    };
  }

  if (
    /(matricularme|inscribirme|quiero inscribirme|solicitud de matricula|confirmar matricula|inscripcion al curso)/.test(
      normalized,
    )
  ) {
    return {
      requestType: 'ENROLLMENT',
      reason: 'Solicitud de matricula en academia (requiere validacion administrativa)',
      acknowledgement:
        'Tu solicitud de matrícula quedó registrada como PENDIENTE DE VALIDACIÓN. Una asesora/secretaria verificará los requisitos y te confirmará por este medio.',
    };
  }

  if (
    /(hablar con una persona|hablar con un asesor|hablar con una asesora|hablar con secretaria|atencion humana|agente humano|pasame con)/.test(
      normalized,
    )
  ) {
    return {
      requestType: 'HUMAN_HANDOFF',
      reason: 'Cliente solicito atencion humana directa',
      acknowledgement:
        'Con gusto te conecto con una asesora/secretaria. Hemos pausado el asistente automático para que te atiendan personalmente por aquí.',
    };
  }

  return null;
}

function buildGroundedLocalFallbackReply(
  snippets: readonly { readonly content: string }[],
): string {
  if (snippets.length === 0) {
    return '¡Hola! Gracias por escribirnos. En este momento no hay clave de Gemini configurada en el entorno local ni documentos coincidentes, pero un asesor puede ayudarte si lo necesitas.';
  }

  return [
    'Te comparto la información verificada disponible en nuestra base de conocimiento local:',
    snippets[0]?.content ?? '',
    '',
    '_(Respuesta local desde base de conocimiento: configura GOOGLE_GENAI_API_KEY para activar redacción conversacional con Gemini.)_',
  ].join('\n');
}

export interface WhatsappInboundProcessorDeps {
  readonly workerId: string;
  readonly config: PlatformConfig;
  readonly logger: StructuredLogger;
  readonly database: PostgresDatabaseClient;
  readonly outboundQueue: Queue<WhatsappOutboundJobPayload, WhatsappOutboundJobResult>;
  readonly aiProvider?: AiModelProvider | undefined;
}

export function createWhatsappInboundProcessor(deps: WhatsappInboundProcessorDeps) {
  const repo = new BotOperationsRepository(deps.database);

  return async (job: Job<WhatsappInboundJobPayload>): Promise<WhatsappInboundJobResult> => {
    const payload = job.data;
    const tenantId = asTenantId(payload.tenantId);

    const registration = await repo.tryRegisterInboundExecution(tenantId, {
      correlationId: payload.correlationId,
      idempotencyKey: payload.idempotencyKey,
      eventType: 'whatsapp.inbound',
    });

    if (registration.isDuplicate) {
      deps.logger.info('Skipped duplicate inbound WhatsApp message via idempotency key', {
        workerId: deps.workerId,
        tenantId,
        externalMessageId: payload.externalMessageId,
      });
      return {
        status: 'duplicate_skipped',
        outboundEnqueued: false,
      };
    }

    await repo.updateExecutionStatus(tenantId, {
      idempotencyKey: payload.idempotencyKey,
      status: 'RUNNING',
      incrementAttempt: true,
    });

    try {
      const conversation = await repo.upsertContactAndConversation(tenantId, {
        phoneE164: payload.fromPhoneE164,
        fullName: payload.contactName ?? payload.fromPhoneE164,
        channel: 'WHATSAPP',
      });

      const recorded = await repo.recordMessage(tenantId, {
        conversationId: conversation.conversationId,
        channel: 'WHATSAPP',
        direction: 'INBOUND',
        senderType: 'CUSTOMER',
        content: payload.textBody,
        externalMessageId: payload.externalMessageId,
        metadata: {
          phoneNumberId: payload.phoneNumberId,
          receivedAt: payload.receivedAt,
        },
      });

      if (!recorded.inserted) {
        await repo.updateExecutionStatus(tenantId, {
          idempotencyKey: payload.idempotencyKey,
          status: 'COMPLETED',
        });
        return {
          status: 'duplicate_skipped',
          conversationId: conversation.conversationId,
          outboundEnqueued: false,
        };
      }

      const canAutoReply = shouldAiAutoReply({
        conversationId: conversation.conversationId,
        tenantId,
        contactId: conversation.contactId,
        channel: 'WHATSAPP',
        mode: conversation.mode,
        aiPaused: conversation.aiPaused,
        updatedAt: conversation.lastMessageAt,
      });

      if (!canAutoReply) {
        await repo.updateExecutionStatus(tenantId, {
          idempotencyKey: payload.idempotencyKey,
          status: 'COMPLETED',
        });
        deps.logger.info('AI auto-reply skipped because conversation is in human/paused mode', {
          workerId: deps.workerId,
          tenantId,
          conversationId: conversation.conversationId,
          mode: conversation.mode,
          aiPaused: conversation.aiPaused,
        });
        return {
          status: 'paused_human',
          conversationId: conversation.conversationId,
          outboundEnqueued: false,
        };
      }

      const detectedIntent = detectApprovalOrHandoffIntent(payload.textBody);
      if (detectedIntent) {
        await repo.createCommercialApproval(tenantId, {
          conversationId: conversation.conversationId,
          contactId: conversation.contactId,
          requestType: detectedIntent.requestType,
          summary: `${detectedIntent.reason}: "${payload.textBody.slice(0, 180)}"`,
          externalSystem: 'EXTERNAL',
          payload: {
            externalMessageId: payload.externalMessageId,
            fromPhoneE164: payload.fromPhoneE164,
            messageText: payload.textBody,
          },
        });

        const escalated = transitionConversationMode(
          {
            conversationId: conversation.conversationId,
            tenantId,
            contactId: conversation.contactId,
            channel: 'WHATSAPP',
            mode: conversation.mode,
            aiPaused: conversation.aiPaused,
            updatedAt: conversation.lastMessageAt,
          },
          {
            nextMode: 'HUMAN',
            actorId: asUserId('system-guardrail'),
            actorRole: 'OPERATOR',
            reason: detectedIntent.reason,
          },
        );

        await repo.updateConversationMode(tenantId, conversation.conversationId, {
          mode: escalated.mode,
          aiPaused: escalated.aiPaused,
          assignedUserId: null,
          pauseReason: escalated.pauseReason ?? detectedIntent.reason,
          actorId: 'system-guardrail',
          actorRole: 'OPERATOR',
          correlationId: payload.correlationId,
        });

        await enqueueWhatsappOutboundJob(deps.outboundQueue, {
          tenantId,
          correlationId: payload.correlationId,
          idempotencyKey: `escalation:${payload.idempotencyKey}`,
          conversationId: conversation.conversationId,
          phoneNumberId: payload.phoneNumberId,
          toPhoneE164: payload.fromPhoneE164,
          textBody: detectedIntent.acknowledgement,
          senderType: 'SYSTEM',
          deliveryMode: payload.deliveryMode,
          metadata: {
            approvalRequestType: detectedIntent.requestType,
          },
        });

        await repo.updateExecutionStatus(tenantId, {
          idempotencyKey: payload.idempotencyKey,
          status: 'COMPLETED',
        });

        return {
          status: 'escalated_human',
          conversationId: conversation.conversationId,
          outboundEnqueued: true,
        };
      }

      const aiContext = await repo.getAiContext(tenantId, conversation.conversationId, 12);
      const snippets = selectRelevantKnowledgeSnippets(
        aiContext.knowledgeDocuments,
        payload.textBody,
        3,
      );

      const knowledgeSection =
        snippets.length > 0
          ? `\n\nCONTEXTO DE CONOCIMIENTO VERIFICADO:\n${snippets.map((s) => s.content).join('\n\n---\n\n')}`
          : '';

      const basePrompt =
        aiContext.agent?.systemPrompt ??
        'Eres un asistente virtual corporativo. Responde con claridad usando únicamente el contexto verificado.';

      const historyMessages: AiMessage[] = aiContext.recentMessages.map((msg) => ({
        role: msg.senderType === 'CUSTOMER' ? 'user' : 'assistant',
        content: msg.content,
      }));

      const trimmedHistory = trimConversationContext(historyMessages, 4000);
      const modelToUse = aiContext.agent?.model ?? deps.config.AI_DEFAULT_MODEL;

      let replyText: string;
      let providerUsed = aiContext.agent?.provider ?? deps.config.AI_DEFAULT_PROVIDER;
      let inputTokens = 0;
      let outputTokens = 0;

      const resolvedProvider =
        deps.aiProvider ??
        (deps.config.GOOGLE_GENAI_API_KEY
          ? new GeminiAiModelProvider({ apiKey: deps.config.GOOGLE_GENAI_API_KEY })
          : undefined);

      if (resolvedProvider) {
        const completion = await resolvedProvider.complete({
          model: modelToUse,
          messages: [
            {
              role: 'system',
              content: `${basePrompt}${knowledgeSection}`,
            },
            ...trimmedHistory,
          ],
          temperature: 0.3,
          maxOutputTokens: 1024,
        });
        replyText = completion.text;
        providerUsed = completion.provider;
        inputTokens = completion.inputTokens;
        outputTokens = completion.outputTokens;
      } else {
        providerUsed = 'custom';
        replyText = buildGroundedLocalFallbackReply(snippets);
      }

      await enqueueWhatsappOutboundJob(deps.outboundQueue, {
        tenantId,
        correlationId: payload.correlationId,
        idempotencyKey: `ai-reply:${payload.idempotencyKey}`,
        conversationId: conversation.conversationId,
        phoneNumberId: payload.phoneNumberId,
        toPhoneE164: payload.fromPhoneE164,
        textBody: replyText,
        senderType: 'AI',
        deliveryMode: payload.deliveryMode,
        metadata: {
          provider: providerUsed,
          model: modelToUse,
          inputTokens,
          outputTokens,
        },
      });

      await repo.updateExecutionStatus(tenantId, {
        idempotencyKey: payload.idempotencyKey,
        status: 'COMPLETED',
      });

      return {
        status: 'replied',
        conversationId: conversation.conversationId,
        outboundEnqueued: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown inbound processor error';
      await repo
        .updateExecutionStatus(tenantId, {
          idempotencyKey: payload.idempotencyKey,
          status: 'FAILED',
          lastError: errorMessage.slice(0, 500),
        })
        .catch(() => undefined);
      throw error;
    }
  };
}
