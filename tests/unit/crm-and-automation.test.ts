import {
  AiToolGuard,
  isDailyCostLimitExceeded,
  renderPromptTemplate,
  trimConversationContext,
} from '@rsd-sync/ai-engine';
import {
  AutomationRegistry,
  computeIdempotencyKey,
  transitionExecutionStatus,
} from '@rsd-sync/automation-core';
import {
  resolveCommercialApproval,
  shouldAiAutoReply,
  transitionConversationMode,
  type CommercialApprovalRequest,
  type ConversationState,
} from '@rsd-sync/crm-core';
import {
  asTenantId,
  asUserId,
  ExternalValidationRequiredError,
  UnauthorizedOperationError,
  ValidationError,
} from '@rsd-sync/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('CRM Attention Modes, Automation Core & AI Tool Guard', () => {
  const tenantId = asTenantId('11111111-1111-4111-8111-111111111111');
  const secretaryId = asUserId('user-secretary-1');
  const aiAgentId = asUserId('system-ai-agent');

  it('pauses AI automatically when a secretary takes over and blocks AI override', () => {
    const initial: ConversationState = {
      conversationId: 'conv-1',
      tenantId,
      contactId: 'contact-1',
      channel: 'WHATSAPP',
      mode: 'AI',
      aiPaused: false,
      updatedAt: '2026-11-17T00:00:00.000Z',
    };

    expect(shouldAiAutoReply(initial)).toBe(true);

    const takenOver = transitionConversationMode(initial, {
      nextMode: 'HUMAN',
      actorId: secretaryId,
      actorRole: 'SECRETARY',
      reason: 'Customer requested payment validation',
    });

    expect(takenOver.mode).toBe('HUMAN');
    expect(takenOver.aiPaused).toBe(true);
    expect(takenOver.assignedUserId).toBe(secretaryId);
    expect(shouldAiAutoReply(takenOver)).toBe(false);

    // AI_AGENT cannot unpause itself or switch mode back to AI
    expect(() =>
      transitionConversationMode(takenOver, {
        nextMode: 'AI',
        actorId: aiAgentId,
        actorRole: 'AI_AGENT',
      }),
    ).toThrow(UnauthorizedOperationError);

    // COPILOT also keeps auto-reply paused
    const copilot = transitionConversationMode(takenOver, {
      nextMode: 'COPILOT',
      actorId: secretaryId,
      actorRole: 'SECRETARY',
    });
    expect(copilot.aiPaused).toBe(true);
    expect(shouldAiAutoReply(copilot)).toBe(false);

    // Explicit human reactivation restores AI mode
    const resumed = transitionConversationMode(copilot, {
      nextMode: 'AI',
      actorId: secretaryId,
      actorRole: 'SECRETARY',
    });
    expect(resumed.aiPaused).toBe(false);
    expect(shouldAiAutoReply(resumed)).toBe(true);
  });

  it('requires explicit external validation before approving commercial requests', () => {
    const request: CommercialApprovalRequest = {
      approvalId: 'appr-1',
      tenantId,
      conversationId: 'conv-1',
      requestType: 'PAYMENT',
      status: 'PENDING_VALIDATION',
      requiresExternalValidation: true,
      externalSystem: 'SUMAK',
      createdAt: '2026-11-17T00:00:00.000Z',
    };

    expect(() =>
      resolveCommercialApproval(request, {
        validatedByExternalSystem: false,
        externalReferenceId: 'pay-001',
      }),
    ).toThrow(ExternalValidationRequiredError);

    const approved = resolveCommercialApproval(request, {
      validatedByExternalSystem: true,
      externalReferenceId: 'pay-001',
    });
    expect(approved.status).toBe('APPROVED');
    expect(approved.externalReferenceId).toBe('pay-001');
  });

  it('computes deterministic idempotency keys and validates execution transitions', () => {
    const k1 = computeIdempotencyKey({
      tenantId,
      eventType: 'whatsapp.message.received',
      externalId: 'wamid.100',
    });
    const k2 = computeIdempotencyKey({
      tenantId,
      eventType: 'WHATSAPP.MESSAGE.RECEIVED',
      externalId: 'wamid.100',
    });
    const k3 = computeIdempotencyKey({
      tenantId: asTenantId('22222222-2222-4222-8222-222222222222'),
      eventType: 'whatsapp.message.received',
      externalId: 'wamid.100',
    });

    expect(k1).toBe(k2);
    expect(k1).not.toBe(k3);

    expect(transitionExecutionStatus('PENDING', 'RUNNING')).toBe('RUNNING');
    expect(transitionExecutionStatus('RUNNING', 'COMPLETED')).toBe('COMPLETED');
    expect(() => transitionExecutionStatus('COMPLETED', 'RUNNING')).toThrow(ValidationError);

    const registry = new AutomationRegistry();
    registry.register({
      name: 'handle-inbound-message',
      eventType: 'whatsapp.message.received',
      handler: async () => {},
    });
    expect(registry.getHandlers('whatsapp.message.received')).toHaveLength(1);
    expect(registry.listEventTypes()).toEqual(['whatsapp.message.received']);
  });

  it('enforces AI tool authorization, schema validation, and external confirmation', async () => {
    const guard = new AiToolGuard();
    guard.registerTool({
      metadata: {
        toolName: 'catalog.search',
        description: 'Read-only product search',
        readOnly: true,
        requiresExternalValidation: false,
        allowedRoles: ['AI_AGENT', 'OPERATOR'],
      },
      inputSchema: z.object({ query: z.string().min(2) }),
      execute: async (args) => ({ results: [`item:${args.query}`] }),
    });

    guard.registerTool({
      metadata: {
        toolName: 'payment.confirm',
        description: 'Confirm payment after external validation',
        readOnly: false,
        requiresExternalValidation: true,
        allowedRoles: ['OPERATOR', 'SECRETARY'],
      },
      inputSchema: z.object({ reference: z.string().min(1) }),
      execute: async (args) => ({ confirmed: args.reference }),
    });

    // Authorized read-only tool succeeds
    const result = await guard.authorizeAndExecute({
      tenantId,
      actorRole: 'AI_AGENT',
      enabledTenantTools: ['catalog.search', 'payment.confirm'],
      toolName: 'catalog.search',
      rawArgs: { query: 'curso' },
    });
    expect(result).toEqual({ results: ['item:curso'] });

    // Tool not enabled for tenant fails
    await expect(
      guard.authorizeAndExecute({
        tenantId,
        actorRole: 'AI_AGENT',
        enabledTenantTools: [],
        toolName: 'catalog.search',
        rawArgs: { query: 'curso' },
      }),
    ).rejects.toThrow(UnauthorizedOperationError);

    // AI_AGENT cannot invoke payment.confirm
    await expect(
      guard.authorizeAndExecute({
        tenantId,
        actorRole: 'AI_AGENT',
        enabledTenantTools: ['payment.confirm'],
        toolName: 'payment.confirm',
        rawArgs: { reference: 'ref-1' },
      }),
    ).rejects.toThrow(UnauthorizedOperationError);

    // Even SECRETARY cannot bypass requiresExternalValidation without external confirmation
    await expect(
      guard.authorizeAndExecute({
        tenantId,
        actorRole: 'SECRETARY',
        enabledTenantTools: ['payment.confirm'],
        toolName: 'payment.confirm',
        rawArgs: { reference: 'ref-1' },
        externalValidationConfirmed: false,
      }),
    ).rejects.toThrow(ExternalValidationRequiredError);

    expect(renderPromptTemplate('Hola {{company}}, bienvenido a {{channel}}', {
      company: 'SUMAK',
      channel: 'WhatsApp',
    })).toBe('Hola SUMAK, bienvenido a WhatsApp');

    expect(
      trimConversationContext(
        [
          { role: 'user', content: '1' },
          { role: 'assistant', content: '2' },
          { role: 'user', content: '3' },
        ],
        2,
      ),
    ).toHaveLength(2);
    expect(isDailyCostLimitExceeded(10, 10)).toBe(true);
  });
});
