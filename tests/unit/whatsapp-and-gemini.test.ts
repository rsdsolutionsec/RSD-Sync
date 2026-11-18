import {
  GeminiAiModelProvider,
  selectRelevantKnowledgeSnippets,
} from '@rsd-sync/ai-engine';
import {
  createLocalMetaWebhookPayload,
  parseMetaWhatsAppWebhookPayload,
  SUMAK_AUDIT_KNOWLEDGE_DOCUMENTS,
  WhatsAppCloudApiAdapter,
} from '@rsd-sync/integrations';
import { asTenantId } from '@rsd-sync/shared';
import { detectApprovalOrHandoffIntent } from '@rsd-sync/worker';
import { describe, expect, it, vi } from 'vitest';

describe('Gemini AI Provider & Knowledge Retrieval', () => {
  it('calls Gemini REST API with header auth and extracts text & token usage cleanly', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('x-goog-api-key')).toBe('fake-gemini-key-for-unit-test');
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        systemInstruction?: { parts: Array<{ text: string }> };
        contents: Array<{ role: string; parts: Array<{ text: string }> }>;
      };
      expect(body.systemInstruction?.parts[0]?.text).toContain('Asistente SUMAK');
      expect(body.contents[0]?.role).toBe('user');

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: 'El producto Formula 1000 tiene un PVP de $60.00.' }],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 120,
            candidatesTokenCount: 18,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    const provider = new GeminiAiModelProvider({
      apiKey: 'fake-gemini-key-for-unit-test',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const result = await provider.complete({
      model: 'gemini-3.8-flash',
      messages: [
        { role: 'system', content: 'Asistente SUMAK' },
        { role: 'user', content: '¿Cuánto cuesta Formula 1000?' },
      ],
    });

    expect(result.provider).toBe('gemini');
    expect(result.text).toContain('$60.00');
    expect(result.inputTokens).toBe(120);
    expect(result.outputTokens).toBe(18);
  });

  it('redacts the Gemini API key if an upstream HTTP error echoes it', async () => {
    const secret = 'AIzaSyFakeSecretUnitTestValue999';
    const fetchMock = vi.fn(async () => {
      return new Response(`Invalid API key: ${secret}`, { status: 403 });
    });

    const provider = new GeminiAiModelProvider({
      apiKey: secret,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(
      provider.complete({
        model: 'gemini-3.8-flash',
        messages: [{ role: 'user', content: 'Hola' }],
      }),
    ).rejects.toThrow(/\[REDACTED_API_KEY\]/);

    await expect(
      provider.complete({
        model: 'gemini-3.8-flash',
        messages: [{ role: 'user', content: 'Hola' }],
      }),
    ).rejects.not.toThrow(secret);
  });

  it('ranks SUMAK audit knowledge documents by relevance for product and academy queries', () => {
    const docs = SUMAK_AUDIT_KNOWLEDGE_DOCUMENTS.map((doc, idx) => ({
      id: `doc-${idx}`,
      title: doc.title,
      category: doc.category,
      content: doc.content,
    }));

    const productSnippets = selectRelevantKnowledgeSnippets(
      docs,
      '¿Qué precio tiene el producto Formula 1000?',
      2,
    );
    expect(productSnippets[0]?.content).toContain('Formula 1000');

    const academySnippets = selectRelevantKnowledgeSnippets(
      docs,
      'Cursos de Academia Salud Renal Chancapiedra',
      2,
    );
    expect(academySnippets[0]?.content).toContain('Academia SUMAK');
  });
});

describe('WhatsApp Cloud API Payload Parser, Adapter & Guardrails', () => {
  it('constructs and parses Meta Cloud API payloads into normalized E.164 messages', () => {
    const rawMetaPayload = createLocalMetaWebhookPayload({
      phoneNumberId: 'local-sumak-phone-id',
      fromPhoneE164: '+593 99-123-4567',
      contactName: 'Carlos Test',
      textBody: 'Hola, quiero información de packs',
      externalMessageId: 'wamid.test.001',
    });

    const parsed = parseMetaWhatsAppWebhookPayload(rawMetaPayload);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.phoneNumberId).toBe('local-sumak-phone-id');
    expect(parsed[0]?.messages[0]).toMatchObject({
      externalMessageId: 'wamid.test.001',
      fromPhoneE164: '+593991234567',
      contactName: 'Carlos Test',
      textBody: 'Hola, quiero información de packs',
    });
  });

  it('dispatches outbound messages without external HTTP calls in local_http mode', async () => {
    const adapter = new WhatsAppCloudApiAdapter({
      deliveryMode: 'local_http',
      phoneNumberId: 'local-sumak-phone-id',
    });

    const result = await adapter.sendMessage({
      tenantId: asTenantId('tenant-demo'),
      toPhoneE164: '+593991234567',
      type: 'text',
      textBody: 'Mensaje de prueba local',
      idempotencyKey: 'idem-001',
    });

    expect(result.externalMessageId).toMatch(/^wamid\.local\./);
  });

  it('detects transactional and human handoff intents for mandatory PENDING_VALIDATION gating', () => {
    expect(detectApprovalOrHandoffIntent('Adjunto comprobante de transferencia Pichincha')?.requestType).toBe(
      'PAYMENT',
    );
    expect(detectApprovalOrHandoffIntent('Quiero comprar el Pack Básico')?.requestType).toBe('SALE');
    expect(detectApprovalOrHandoffIntent('Quiero matricularme en el curso renal')?.requestType).toBe(
      'ENROLLMENT',
    );
    expect(detectApprovalOrHandoffIntent('Por favor pásame con una secretaria')?.requestType).toBe(
      'HUMAN_HANDOFF',
    );
    expect(detectApprovalOrHandoffIntent('¿Cuánto cuesta el Té Extractos de la Vida?')).toBeNull();
  });
});
