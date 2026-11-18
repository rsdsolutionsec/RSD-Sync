import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import type {
  WhatsAppAdapterPort,
  WhatsAppInboundMessage,
  WhatsAppOutboundMessage,
  WhatsAppSendResult,
} from './index.js';

const MetaContactSchema = z.object({
  wa_id: z.string().min(1),
  profile: z
    .object({
      name: z.string().optional(),
    })
    .optional(),
});

const MetaInboundMessageSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(4),
  timestamp: z.string().optional(),
  type: z.string().min(1),
  text: z
    .object({
      body: z.string(),
    })
    .optional(),
  button: z
    .object({
      text: z.string(),
    })
    .optional(),
  interactive: z
    .object({
      button_reply: z.object({ title: z.string() }).optional(),
      list_reply: z.object({ title: z.string() }).optional(),
    })
    .optional(),
  image: z
    .object({
      caption: z.string().optional(),
    })
    .optional(),
  document: z
    .object({
      caption: z.string().optional(),
      filename: z.string().optional(),
    })
    .optional(),
});

const MetaWebhookValueSchema = z.object({
  messaging_product: z.literal('whatsapp').optional(),
  metadata: z.object({
    phone_number_id: z.string().min(1),
    display_phone_number: z.string().optional(),
  }),
  contacts: z.array(MetaContactSchema).optional(),
  messages: z.array(MetaInboundMessageSchema).optional(),
});

const MetaWebhookPayloadSchema = z.object({
  object: z.string().optional(),
  entry: z
    .array(
      z.object({
        id: z.string().optional(),
        changes: z.array(
          z.object({
            field: z.string().optional(),
            value: MetaWebhookValueSchema,
          }),
        ),
      }),
    )
    .default([]),
});

export interface ParsedWhatsAppWebhookBatch {
  readonly phoneNumberId: string;
  readonly displayPhoneNumber?: string | undefined;
  readonly messages: readonly WhatsAppInboundMessage[];
}

export function normalizePhoneToE164(rawPhone: string): string {
  const trimmed = rawPhone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return trimmed;
  }
  return `+${digits}`;
}

function extractMessageText(message: z.infer<typeof MetaInboundMessageSchema>): string {
  if (message.text?.body) {
    return message.text.body;
  }
  if (message.button?.text) {
    return message.button.text;
  }
  if (message.interactive?.button_reply?.title) {
    return message.interactive.button_reply.title;
  }
  if (message.interactive?.list_reply?.title) {
    return message.interactive.list_reply.title;
  }
  if (message.image) {
    return message.image.caption?.trim()
      ? `[Imagen adjunta] ${message.image.caption.trim()}`
      : '[Imagen adjunta: posible comprobante]';
  }
  if (message.document) {
    const label = message.document.filename ?? 'documento';
    return message.document.caption?.trim()
      ? `[Documento adjunto: ${label}] ${message.document.caption.trim()}`
      : `[Documento adjunto: ${label}]`;
  }
  return `[Mensaje tipo ${message.type}]`;
}

function toIsoTimestamp(unixSeconds?: string): string {
  if (!unixSeconds) {
    return new Date().toISOString();
  }
  const parsedSeconds = Number(unixSeconds);
  if (!Number.isFinite(parsedSeconds) || parsedSeconds <= 0) {
    return new Date().toISOString();
  }
  return new Date(parsedSeconds * 1000).toISOString();
}

export function parseMetaWhatsAppWebhookPayload(
  rawPayload: unknown,
): readonly ParsedWhatsAppWebhookBatch[] {
  const payload = MetaWebhookPayloadSchema.parse(rawPayload);
  const batches: ParsedWhatsAppWebhookBatch[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field && change.field !== 'messages') {
        continue;
      }

      const contactNames = new Map<string, string>();
      for (const contact of change.value.contacts ?? []) {
        const name = contact.profile?.name?.trim();
        if (name) {
          contactNames.set(normalizePhoneToE164(contact.wa_id), name);
        }
      }

      const messages: WhatsAppInboundMessage[] = [];
      for (const msg of change.value.messages ?? []) {
        const normalizedFrom = normalizePhoneToE164(msg.from);
        messages.push({
          externalMessageId: msg.id,
          fromPhoneE164: normalizedFrom,
          contactName: contactNames.get(normalizedFrom),
          textBody: extractMessageText(msg),
          receivedAt: toIsoTimestamp(msg.timestamp),
        });
      }

      if (messages.length > 0) {
        batches.push({
          phoneNumberId: change.value.metadata.phone_number_id,
          displayPhoneNumber: change.value.metadata.display_phone_number,
          messages,
        });
      }
    }
  }

  return batches;
}

export interface LocalMetaWebhookPayloadInput {
  readonly phoneNumberId: string;
  readonly fromPhoneE164: string;
  readonly contactName?: string | undefined;
  readonly textBody: string;
  readonly externalMessageId?: string | undefined;
}

export function createLocalMetaWebhookPayload(
  input: LocalMetaWebhookPayloadInput,
): Record<string, unknown> {
  const waId = input.fromPhoneE164.replace(/\D/g, '') || input.fromPhoneE164;
  const externalId = input.externalMessageId ?? `wamid.sim.${randomUUID()}`;
  const unixTimestamp = String(Math.floor(Date.now() / 1000));

  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'local-whatsapp-business-account',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '593986046654',
                phone_number_id: input.phoneNumberId,
              },
              contacts: [
                {
                  wa_id: waId,
                  profile: {
                    name: input.contactName?.trim() || `Contacto ${waId.slice(-4)}`,
                  },
                },
              ],
              messages: [
                {
                  from: waId,
                  id: externalId,
                  timestamp: unixTimestamp,
                  type: 'text',
                  text: {
                    body: input.textBody,
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

export interface WhatsAppCloudApiAdapterOptions {
  readonly deliveryMode: 'local_http' | 'cloud_api';
  readonly phoneNumberId: string;
  readonly accessToken?: string | undefined;
  readonly apiVersion?: string | undefined;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

export class WhatsAppCloudApiAdapter implements WhatsAppAdapterPort {
  private readonly deliveryMode: 'local_http' | 'cloud_api';
  private readonly phoneNumberId: string;
  private readonly accessToken: string | undefined;
  private readonly apiVersion: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  public constructor(options: WhatsAppCloudApiAdapterOptions) {
    this.deliveryMode = options.deliveryMode;
    this.phoneNumberId = options.phoneNumberId;
    this.accessToken = options.accessToken?.trim() || undefined;
    this.apiVersion = options.apiVersion ?? 'v22.0';
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  public async sendMessage(message: WhatsAppOutboundMessage): Promise<WhatsAppSendResult> {
    if (this.deliveryMode === 'local_http') {
      return {
        externalMessageId: `wamid.local.${randomUUID()}`,
        acceptedAt: new Date().toISOString(),
      };
    }

    if (!this.accessToken) {
      throw new Error('WHATSAPP_ACCESS_TOKEN is required when WHATSAPP_DELIVERY_MODE=cloud_api.');
    }

    if (message.type !== 'text' || !message.textBody) {
      throw new Error('Only text outbound messages are enabled in this stage.');
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const endpoint = `https://graph.facebook.com/${this.apiVersion}/${encodeURIComponent(this.phoneNumberId)}/messages`;
      const toDigits = message.toPhoneE164.replace(/\D/g, '');
      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toDigits,
          type: 'text',
          text: {
            preview_url: false,
            body: message.textBody,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const rawErr = await response.text().catch(() => 'Unknown error');
        const safeErr = rawErr.slice(0, 300).split(this.accessToken).join('[REDACTED_TOKEN]');
        throw new Error(`WhatsApp Cloud API failed (${response.status}): ${safeErr}`);
      }

      const data = (await response.json()) as { messages?: Array<{ id?: string }> };
      const externalMessageId = data.messages?.[0]?.id ?? `wamid.cloud.${randomUUID()}`;
      return {
        externalMessageId,
        acceptedAt: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
