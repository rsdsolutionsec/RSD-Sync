'use client';

import {
  AlertTriangle,
  Bot,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type {
  ConversationDetailDto,
  ConversationModeDto,
  ConversationSummaryDto,
} from '@/lib/types';

interface ConversationsViewProps {
  readonly initialConversations: readonly ConversationSummaryDto[];
  readonly initialTenantSlug?: string | undefined;
  readonly initialError?: string | undefined;
}

const QUICK_PROMPTS = [
  'Hola, ¿qué productos y precios tienen disponibles?',
  '¿Cuáles son los packs de ingreso y beneficios de distribuidor?',
  'Quiero información sobre los cursos de la academia',
  'Ya hice la transferencia, adjunto comprobante de pago',
] as const;

export function ConversationsView({
  initialConversations,
  initialTenantSlug,
  initialError,
}: ConversationsViewProps) {
  const [conversations, setConversations] =
    useState<readonly ConversationSummaryDto[]>(initialConversations);
  const [activeTenantLabel, setActiveTenantLabel] = useState(
    initialTenantSlug ?? 'canal WhatsApp activo',
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversations[0]?.conversationId ?? null,
  );
  const [detail, setDetail] = useState<ConversationDetailDto | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | undefined>(initialError);
  const [loadingList, setLoadingList] = useState(false);

  // Simulator state
  const [simPhone, setSimPhone] = useState('+593991234567');
  const [simName, setSimName] = useState('María Cliente Demo');
  const [simText, setSimText] = useState('');
  const [simSending, setSimSending] = useState(false);

  // Human reply state
  const [humanReply, setHumanReply] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [modeUpdating, setModeUpdating] = useState(false);

  const refreshConversations = useCallback(async (preferredId?: string | null) => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/platform/conversations', {
        cache: 'no-store',
      });
      const data = (await res.json()) as {
        ok?: boolean;
        tenantSlug?: string;
        conversations?: ConversationSummaryDto[];
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setErrorMsg(data.error ?? 'Error cargando conversaciones');
        return;
      }

      if (data.tenantSlug) {
        setActiveTenantLabel(data.tenantSlug);
      }
      setErrorMsg(undefined);
      const list = data.conversations ?? [];
      setConversations(list);
      const nextSelected = preferredId ?? selectedId ?? list[0]?.conversationId ?? null;
      if (nextSelected && list.some((c) => c.conversationId === nextSelected)) {
        setSelectedId(nextSelected);
      } else if (list[0]) {
        setSelectedId(list[0].conversationId);
      }
    } finally {
      setLoadingList(false);
    }
  }, [selectedId]);

  const loadDetail = useCallback(async (conversationId: string) => {
    const res = await fetch(
      `/api/platform/conversations/${encodeURIComponent(conversationId)}/messages`,
      { cache: 'no-store' },
    );
    const data = (await res.json()) as {
      ok?: boolean;
      detail?: ConversationDetailDto;
      error?: string;
    };
    if (res.ok && data.ok && data.detail) {
      setDetail(data.detail);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  async function handleSimulateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!simText.trim()) return;
    setSimSending(true);
    setErrorMsg(undefined);
    try {
      const res = await fetch('/api/platform/simulator/whatsapp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fromPhoneE164: simPhone.trim(),
          contactName: simName.trim() || undefined,
          textBody: simText.trim(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error ?? 'No se pudo simular el mensaje');
        return;
      }
      setSimText('');
      // Allow worker brief time to persist inbound + AI outbound message
      setTimeout(() => {
        void refreshConversations(selectedId);
        if (selectedId) void loadDetail(selectedId);
      }, 900);
      setTimeout(() => {
        void refreshConversations(selectedId);
        if (selectedId) void loadDetail(selectedId);
      }, 2400);
    } finally {
      setSimSending(false);
    }
  }

  async function handleChangeMode(mode: ConversationModeDto) {
    if (!selectedId) return;
    setModeUpdating(true);
    try {
      const res = await fetch(
        `/api/platform/conversations/${encodeURIComponent(selectedId)}/mode`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            mode,
            reason:
              mode === 'HUMAN'
                ? 'Intervención manual desde panel operativo'
                : 'Reactivado desde panel operativo',
          }),
        },
      );
      if (res.ok) {
        await refreshConversations(selectedId);
        await loadDetail(selectedId);
      }
    } finally {
      setModeUpdating(false);
    }
  }

  async function handleSendHumanReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !humanReply.trim()) return;
    setReplySending(true);
    try {
      const res = await fetch(
        `/api/platform/conversations/${encodeURIComponent(selectedId)}/reply`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ textBody: humanReply.trim() }),
        },
      );
      if (res.ok) {
        setHumanReply('');
        setTimeout(() => {
          void refreshConversations(selectedId);
          void loadDetail(selectedId);
        }, 700);
      }
    } finally {
      setReplySending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            WhatsApp Local & CRM Operativo
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Simulador webhook HMAC-SHA256, atención con IA + base de conocimiento por tenant e
            intervención humana con pausa automática.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void refreshConversations(selectedId);
            if (selectedId) void loadDetail(selectedId);
          }}
          disabled={loadingList}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Local WhatsApp Simulator */}
      <form
        onSubmit={handleSimulateSubmit}
        className="rounded-xl border border-slate-800 bg-[#0d0e17] p-4 shadow-sm"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <MessageSquare className="h-4 w-4 text-fuchsia-400" />
            Simulador Webhook WhatsApp (HTTP Local Firmado)
          </div>
          <span className="rounded bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-medium text-fuchsia-300">
            Tenant: {activeTenantLabel}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-12">
          <input
            type="text"
            value={simPhone}
            onChange={(e) => setSimPhone(e.target.value)}
            placeholder="+593991234567"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 md:col-span-3"
          />
          <input
            type="text"
            value={simName}
            onChange={(e) => setSimName(e.target.value)}
            placeholder="Nombre contacto"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 md:col-span-3"
          />
          <input
            type="text"
            value={simText}
            onChange={(e) => setSimText(e.target.value)}
            placeholder="Escribe el mensaje del cliente..."
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 md:col-span-4"
          />
          <button
            type="submit"
            disabled={simSending || !simText.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-500 disabled:opacity-50 md:col-span-2"
          >
            <Send className="h-3.5 w-3.5" />
            {simSending ? 'Enviando...' : 'Simular'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setSimText(prompt)}
              className="rounded-md border border-slate-800 bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-300 hover:border-fuchsia-500/40 hover:text-white"
            >
              {prompt}
            </button>
          ))}
        </div>
      </form>

      {/* Master / Detail CRM Inbox */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-800 bg-[#0d0e17] p-3 lg:col-span-4">
          <h2 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Conversaciones ({conversations.length})
          </h2>
          <div className="space-y-2">
            {conversations.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-slate-500">
                No hay conversaciones aún. Usa el simulador superior para enviar un mensaje.
              </p>
            ) : (
              conversations.map((conv) => {
                const isSelected = conv.conversationId === selectedId;
                return (
                  <button
                    key={conv.conversationId}
                    type="button"
                    onClick={() => setSelectedId(conv.conversationId)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      isSelected
                        ? 'border-fuchsia-500/50 bg-fuchsia-500/10'
                        : 'border-slate-800/80 bg-slate-950/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-white">
                        {conv.contactName}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          conv.mode === 'AI'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : conv.mode === 'HUMAN'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-violet-500/20 text-violet-300'
                        }`}
                      >
                        {conv.mode}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">{conv.phoneE164}</div>
                    {conv.lastMessagePreview && (
                      <div className="mt-1.5 line-clamp-2 text-xs text-slate-300">
                        {conv.lastMessagePreview}
                      </div>
                    )}
                    {conv.pendingApprovalsCount > 0 && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                        <ShieldAlert className="h-3 w-3" />
                        {conv.pendingApprovalsCount} pendiente(s) de validación
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex min-h-[460px] flex-col rounded-xl border border-slate-800 bg-[#0d0e17] p-4 lg:col-span-8">
          {!detail ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              Selecciona una conversación para ver el historial y controlar el modo de atención.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <div className="text-base font-semibold text-white">
                    {detail.conversation.contactName}
                  </div>
                  <div className="text-xs text-slate-400">
                    {detail.conversation.phoneE164} · Canal {detail.conversation.channel}
                    {detail.conversation.aiPaused && ' · IA Pausada'}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {(['AI', 'HUMAN', 'COPILOT'] as const).map((modeOption) => {
                    const active = detail.conversation.mode === modeOption;
                    return (
                      <button
                        key={modeOption}
                        type="button"
                        disabled={modeUpdating || active}
                        onClick={() => void handleChangeMode(modeOption)}
                        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                          active
                            ? 'bg-fuchsia-600 text-white'
                            : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {modeOption === 'AI' ? (
                          <Bot className="h-3.5 w-3.5" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                        {modeOption}
                      </button>
                    );
                  })}
                </div>
              </div>

              {detail.approvals.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {detail.approvals.map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
                    >
                      <div>
                        <span className="font-semibold">[{app.requestType}]</span> {app.summary}
                      </div>
                      <span className="shrink-0 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold">
                        {app.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="my-4 flex-1 space-y-3 overflow-y-auto pr-1">
                {detail.messages.map((msg) => {
                  const isInbound = msg.direction === 'INBOUND';
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-sm ${
                          isInbound
                            ? 'border border-slate-800 bg-slate-900 text-slate-100'
                            : msg.senderType === 'HUMAN'
                              ? 'border border-amber-500/40 bg-amber-500/15 text-amber-50'
                              : msg.senderType === 'SYSTEM'
                                ? 'border border-violet-500/40 bg-violet-500/15 text-violet-100'
                                : 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-50'
                        }`}
                      >
                        <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider opacity-75">
                          <span>{msg.senderType}</span>
                          <span>·</span>
                          <span>{new Date(msg.sentAt).toLocaleTimeString()}</span>
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleSendHumanReply} className="flex gap-2 border-t border-slate-800 pt-3">
                <input
                  type="text"
                  value={humanReply}
                  onChange={(e) => setHumanReply(e.target.value)}
                  placeholder="Responder como secretaria/asesor humano (pausa la IA automáticamente)..."
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={replySending || !humanReply.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  <UserCheck className="h-4 w-4" />
                  {replySending ? 'Enviando...' : 'Responder'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
