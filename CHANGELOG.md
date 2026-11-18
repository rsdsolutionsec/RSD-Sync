# CHANGELOG.md

Todos los cambios relevantes de **RSD Sync** se registran cronológicamente en este archivo siguiendo una estructura inspirada en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [0.3.0-local-bot] — 2026-11-18

### Agregado (Bot WhatsApp Local, Gemini AI, Conocimiento SUMAK y CRM Operativo)
- `@rsd-sync/configuration`: soporte para `AI_DEFAULT_MODEL` (`gemini-3.8-flash`) y `WHATSAPP_DELIVERY_MODE` (`local_http` | `cloud_api`).
- `@rsd-sync/database`: migración `0003_whatsapp_ai_crm_local.sql` aplicada en Supabase (`channel_connections`, `ai_agents`, `knowledge_documents`, `contacts`, `conversations`, `messages`, `automation_executions`, `commercial_approvals` con RLS estricto y funciones `resolve_channel_tenant` / `resolve_tenant_id_by_slug`), además de `BotOperationsRepository`.
- `@rsd-sync/ai-engine`: proveedor `GeminiAiModelProvider` sobre Gemini REST API (autenticación por cabecera y redacción de API key en errores) y selector genérico `selectRelevantKnowledgeSnippets`.
- `@rsd-sync/integrations`: adaptador `WhatsAppCloudApiAdapter` (`local_http` / `cloud_api`), parser Zod `parseMetaWhatsAppWebhookPayload`, generador `createLocalMetaWebhookPayload` y base de conocimiento auditada en modo solo lectura de `..\Sumak` (`packages/integrations/src/sumak/knowledge.ts`, `docs/integrations/sumak-integration.md`).
- `@rsd-sync/queue`: contratos BullMQ tipados para `QUEUE_NAMES.WHATSAPP_INBOUND` y `QUEUE_NAMES.WHATSAPP_OUTBOUND`.
- `apps/api` y `apps/worker`: verificación HMAC-SHA256 `GET/POST /api/v1/webhooks/whatsapp`, simulador firmado `POST /api/v1/simulator/whatsapp/inbound`, endpoints de conversaciones `/api/v1/conversations/*`, procesadores inbound/outbound con idempotencia, pausa automática en modo `HUMAN` y bloqueo `PENDING_VALIDATION` para pagos/compras/matrículas.
- `apps/admin`: vista `/conversations` con simulador HTTP local, hilo en vivo, cambio de modo (`AI` / `HUMAN` / `COPILOT`) y respuesta humana.
- Script `pnpm seed:sumak` (`scripts/seed-sumak-local.mjs`) y pruebas unitarias/E2E (`tests/unit/whatsapp-and-gemini.test.ts`, `tests/integration/whatsapp-bot-e2e.test.ts`).

## [0.2.0-phase1] — 2026-11-17

### Agregado (Fase 1 — Infraestructura operativa, Supabase y primer panel web)
- `@rsd-sync/configuration`: soporte para `RSD_DATABASE_URL`, `RSD_DATABASE_DIRECT_URL`, `DATABASE_TARGET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `ADMIN_API_KEY`, `APP_URL`, `API_URL`, `NEXT_PUBLIC_SUPABASE_*`, `DEV_ADMIN_ACCESS_KEY` y cargador seguro `.env` local (`loadLocalEnvIfPresent`).
- `@rsd-sync/database`: cliente real `PostgresDatabaseClient` (`pg.Pool` con transacciones multi-tenant `app.current_tenant_id`), conector `SupabaseConnector`, runner de migraciones SQL y migración `0002_phase1_supabase_hardening.sql` (endurecimiento RLS y rol no superusuario `rsd_sync_app`).
- `@rsd-sync/queue`: conexión `ioredis` (`createRedisConnection`, `checkRedisHealth`), colas/workers BullMQ reales (`enqueueTestJob`, `getTestJobStatus`, `listRecentTestJobs`) y heartbeat de presencia del worker.
- `apps/api`: servidor HTTP Fastify 5 con Helm/CORS, correlación, error handler global, protección administrativa y endpoints `/health`, `/health/live`, `/health/ready`, `/api/v1/status`, `/api/v1/jobs/test`, `/api/v1/jobs`, `/api/v1/jobs/:jobId`.
- `apps/worker`: proceso worker independiente BullMQ con procesador `platform.health.test-job`, control de concurrencia, reintentos/backoff, heartbeat en Redis y apagado controlado.
- `apps/admin`: panel operativo web en Next.js 16 + Tailwind CSS 4 + Lucide Icons con rutas `/`, `/infrastructure`, `/jobs` y `/login`, patrón BFF (`/api/platform/*`) sin secretos en navegador, soporte Supabase Auth + `ADMIN_EMAILS` y configuración `vercel.json` / `next.config.ts`.
- Documentación de Fase 1 ([docs/phases/phase-1.md](./docs/phases/phase-1.md), [docs/operations/vercel-deployment.md](./docs/operations/vercel-deployment.md)) y pruebas de integración reales contra PostgreSQL, Redis, Fastify y Worker BullMQ.

## [0.1.0-phase0] — 2026-11-17

### Agregado (Fase 0 — Arquitectura y preparación)
- Inicialización del monorepo `pnpm` con TypeScript estricto (`NodeNext`, Project References) y Vitest.
- Configuración local reproducible con Docker Compose (`redis:7.4-alpine` y `pgvector/pgvector:pg17` vinculados a `127.0.0.1`) y `.env.example`.
- Documentación maestra completa: `AGENTS.md`, `README.md`, `ROADMAP.md` (Fases 0–10), `ARCHITECTURE.md`, `DECISIONS.md` (ADRs 001–006), `CONTRIBUTING.md`, `SECURITY.md` y guías en `docs/`.
- Paquetes base del monolito modular:
  - `@rsd-sync/shared`
  - `@rsd-sync/contracts`
  - `@rsd-sync/configuration`
  - `@rsd-sync/observability`
  - `@rsd-sync/security` (aislamiento por tenant, cifrado AES-256-GCM, firmas HMAC, RBAC)
  - `@rsd-sync/queue`
  - `@rsd-sync/database` (contratos multi-tenant y migración SQL inicial `0001_phase0_foundation.sql` con RLS)
  - `@rsd-sync/automation-core`
  - `@rsd-sync/ai-engine`
  - `@rsd-sync/crm-core`
  - `@rsd-sync/integrations` (`whatsapp`, `sumak`, `generic-api`, `email`)
- Puntos de entrada base para `apps/api`, `apps/worker` y `apps/admin`, junto con Dockerfiles multi-etapa en `infrastructure/docker/`.
- Script de verificación `scripts/verify-foundation.mjs`, flujo CI en `.github/workflows/ci.yml` y suites iniciales de pruebas unitarias, contratos y fronteras arquitectónicas.
