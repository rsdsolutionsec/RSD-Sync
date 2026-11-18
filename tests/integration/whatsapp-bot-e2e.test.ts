import { randomUUID } from 'node:crypto';
import type { AiCompletionRequest, AiModelProvider } from '@rsd-sync/ai-engine';
import { buildApiServer, type ApiServerRuntime } from '@rsd-sync/api';
import { parsePlatformConfig } from '@rsd-sync/configuration';
import { BotOperationsRepository } from '@rsd-sync/database';
import {
  SUMAK_AUDIT_KNOWLEDGE_DOCUMENTS,
  SUMAK_DEFAULT_SYSTEM_PROMPT,
} from '@rsd-sync/integrations';
import { computeHmacSha256Signature } from '@rsd-sync/security';
import { startWorkerRuntime, type WorkerRuntime } from '@rsd-sync/worker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

async function waitForCondition<T>(
  fn: () => Promise<T | null | undefined>,
  timeoutMs = 10000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value !== null && value !== undefined) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Timed out waiting for async bot processing');
}

describe('Local WhatsApp Bot End-to-End: Signed Webhook -> BullMQ -> Gemini -> CRM -> Human Takeover', () => {
  const adminApiKey = 'wa-e2e-admin-key-123456';
  const verifyToken = 'wa-e2e-verify-token';
  const appSecret = 'wa-e2e-app-secret-for-hmac-sha256';
  const uniqueSuffix = randomUUID().slice(0, 8);
  const testTenantSlug = `test-sumak-wa-${uniqueSuffix}`;
  const testPhoneNumberId = `local-phone-${uniqueSuffix}`;
  const customerPhone = `+5939900${Math.floor(10000 + Math.random() * 89999)}`;

  let aiCallsCount = 0;
  const mockedGeminiProvider: AiModelProvider = {
    providerName: 'gemini',
    async complete(request: AiCompletionRequest) {
      aiCallsCount += 1;
      const sysPrompt = request.messages.find((m) => m.role === 'system')?.content ?? '';
      expect(sysPrompt).toContain('Formula 1000');
      return {
        provider: 'gemini',
        model: request.model,
        text: 'Con gusto te informo: Formula 1000 tiene PVP de $60.00 (precio fijo distribuidor $20.00).',
        toolCalls: [],
        inputTokens: 90,
        outputTokens: 22,
      };
    },
  };

  let apiRuntime: ApiServerRuntime;
  let workerRuntime: WorkerRuntime | null = null;
  let repo: BotOperationsRepository;
  let testTenantId: string;
  let baseUrl = '';

  beforeAll(async () => {
    const config = parsePlatformConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      API_HOST: '127.0.0.1',
      API_PORT: '0',
      REDIS_URL: 'redis://127.0.0.1:6379',
      DATABASE_TARGET: 'local',
      DATABASE_URL: 'postgresql://rsd_sync:rsd_sync_dev_password@127.0.0.1:54332/rsd_sync_dev',
      ADMIN_API_KEY: adminApiKey,
      WORKER_CONCURRENCY: '2',
      AI_DEFAULT_PROVIDER: 'gemini',
      AI_DEFAULT_MODEL: 'gemini-3.8-flash',
      WHATSAPP_DELIVERY_MODE: 'local_http',
      WHATSAPP_VERIFY_TOKEN: verifyToken,
      WHATSAPP_APP_SECRET: appSecret,
      WHATSAPP_PHONE_NUMBER_ID: testPhoneNumberId,
    });

    apiRuntime = await buildApiServer({ config });
    baseUrl = await apiRuntime.listen();
    repo = new BotOperationsRepository(apiRuntime.database);

    const tenantId = await repo.ensureTenant({
      slug: testTenantSlug,
      name: `Test Tenant ${uniqueSuffix}`,
    });
    testTenantId = tenantId;

    await repo.upsertChannelConnection(tenantId, {
      channel: 'WHATSAPP',
      externalAccountId: testPhoneNumberId,
      displayName: 'Test WhatsApp Channel',
    });
    await repo.upsertAiAgent(tenantId, {
      name: 'Test Gemini Agent',
      provider: 'gemini',
      model: 'gemini-3.8-flash',
      systemPrompt: SUMAK_DEFAULT_SYSTEM_PROMPT,
    });
    for (const doc of SUMAK_AUDIT_KNOWLEDGE_DOCUMENTS) {
      await repo.upsertKnowledgeDocument(tenantId, doc);
    }

    workerRuntime = await startWorkerRuntime({
      config,
      aiProvider: mockedGeminiProvider,
    });
  }, 20000);

  afterAll(async () => {
    if (workerRuntime) {
      await workerRuntime.close();
      workerRuntime = null;
    }
    if (apiRuntime) {
      if (testTenantId) {
        await apiRuntime.database
          .withTenantTransaction(testTenantId as never, async (tx) => {
            await tx.query('DELETE FROM tenants WHERE id = $1', [testTenantId]);
          })
          .catch(() => undefined);
      }
      await apiRuntime.close();
    }
  });

  it('verifies Meta webhook challenge and rejects unsigned webhook POSTs with 401', async () => {
    const okVerify = await fetch(
      `${baseUrl}/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=challenge-123`,
    );
    expect(okVerify.status).toBe(200);
    expect(await okVerify.text()).toBe('challenge-123');

    const badVerify = await fetch(
      `${baseUrl}/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123`,
    );
    expect(badVerify.status).toBe(403);

    const unsignedPost = await fetch(`${baseUrl}/api/v1/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ object: 'whatsapp_business_account', entry: [] }),
    });
    expect(unsignedPost.status).toBe(401);
  });

  it('processes simulated inbound WhatsApp -> Gemini reply -> idempotency -> HUMAN pause -> PENDING_VALIDATION', async () => {
    const externalMsg1 = `wamid.e2e.1.${uniqueSuffix}`;
    const simRes = await fetch(`${baseUrl}/api/v1/simulator/whatsapp/inbound`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-api-key': adminApiKey,
      },
      body: JSON.stringify({
        phoneNumberId: testPhoneNumberId,
        fromPhoneE164: customerPhone,
        contactName: 'Cliente E2E',
        textBody: 'Hola, ¿cuál es el precio de Formula 1000?',
        externalMessageId: externalMsg1,
      }),
    });
    expect(simRes.status).toBe(200);

    const conversationId = await waitForCondition(async () => {
      const list = await repo.listConversations(testTenantId as never, 10);
      const match = list.find((c) => c.phoneE164 === customerPhone);
      if (!match) return null;
      const detail = await repo.getConversationDetail(testTenantId as never, match.conversationId);
      if (!detail || detail.messages.length < 2) return null;
      return match.conversationId;
    });

    const firstDetail = await repo.getConversationDetail(testTenantId as never, conversationId);
    expect(firstDetail?.messages.map((m) => m.senderType)).toEqual(['CUSTOMER', 'AI']);
    expect(firstDetail?.messages[1]?.content).toContain('$60.00');
    expect(aiCallsCount).toBe(1);

    // Send duplicate webhook with identical external message id (signed HMAC) -> must not trigger a 2nd AI call
    const duplicateMetaBody = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: testPhoneNumberId },
                contacts: [{ wa_id: customerPhone.replace(/\D/g, ''), profile: { name: 'Cliente E2E' } }],
                messages: [
                  {
                    from: customerPhone.replace(/\D/g, ''),
                    id: externalMsg1,
                    type: 'text',
                    text: { body: 'Hola, ¿cuál es el precio de Formula 1000?' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const dupSig = computeHmacSha256Signature(duplicateMetaBody, appSecret, 'sha256=');
    const dupRes = await fetch(`${baseUrl}/api/v1/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': dupSig,
      },
      body: duplicateMetaBody,
    });
    expect(dupRes.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(aiCallsCount).toBe(1);

    // Pause AI via HUMAN takeover mode -> next message should be stored without AI reply
    const modeRes = await fetch(
      `${baseUrl}/api/v1/conversations/${conversationId}/mode?tenantSlug=${testTenantSlug}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-api-key': adminApiKey,
        },
        body: JSON.stringify({ mode: 'HUMAN', reason: 'Secretaria atendiendo' }),
      },
    );
    expect(modeRes.status).toBe(200);

    const externalMsg2 = `wamid.e2e.2.${uniqueSuffix}`;
    await fetch(`${baseUrl}/api/v1/simulator/whatsapp/inbound`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-api-key': adminApiKey,
      },
      body: JSON.stringify({
        phoneNumberId: testPhoneNumberId,
        fromPhoneE164: customerPhone,
        textBody: '¿Siguen ahí?',
        externalMessageId: externalMsg2,
      }),
    });

    await waitForCondition(async () => {
      const detail = await repo.getConversationDetail(testTenantId as never, conversationId);
      return detail && detail.messages.length >= 3 ? true : null;
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(aiCallsCount).toBe(1);

    // Return to AI mode and send payment proof -> must create PENDING_VALIDATION approval and pause AI
    await fetch(
      `${baseUrl}/api/v1/conversations/${conversationId}/mode?tenantSlug=${testTenantSlug}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-api-key': adminApiKey,
        },
        body: JSON.stringify({ mode: 'AI' }),
      },
    );

    const externalMsg3 = `wamid.e2e.3.${uniqueSuffix}`;
    await fetch(`${baseUrl}/api/v1/simulator/whatsapp/inbound`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-api-key': adminApiKey,
      },
      body: JSON.stringify({
        phoneNumberId: testPhoneNumberId,
        fromPhoneE164: customerPhone,
        textBody: 'Ya hice transferencia, adjunto comprobante de pago',
        externalMessageId: externalMsg3,
      }),
    });

    const finalDetail = await waitForCondition(async () => {
      const detail = await repo.getConversationDetail(testTenantId as never, conversationId);
      if (!detail || detail.approvals.length === 0 || detail.messages.length < 5) return null;
      return detail;
    });

    expect(finalDetail.conversation.mode).toBe('HUMAN');
    expect(finalDetail.conversation.aiPaused).toBe(true);
    expect(finalDetail.approvals[0]?.requestType).toBe('PAYMENT');
    expect(finalDetail.approvals[0]?.status).toBe('PENDING_VALIDATION');
    expect(aiCallsCount).toBe(1);
  }, 25000);
});
