# CONTEXT.md — Registro Maestro de Contexto, Iteraciones, Funcionalidades e Integraciones

Este documento es la **fuente viva de contexto operativo y técnico de RSD Sync**.
Todo agente o ingeniero que realice cambios en el repositorio **tiene la obligación de actualizar este archivo en cada iteración**, respondiendo explícitamente:
1. **¿Qué se está haciendo?**
2. **¿Por qué se está haciendo?**
3. **¿Cómo se está haciendo?**
4. **¿Qué funcionalidades o integraciones se crearon o modificaron?**

---

## 1. Visión Ejecutiva y Contexto General

- **Producto**: **RSD Sync** (propiedad tecnológica de **RSD Solutions**).
- **Propósito**: Plataforma modular multiempresa (multi-tenant) para automatización de procesos, orquestación de agentes de inteligencia artificial, mensajería omnicanal (WhatsApp y otros canales), CRM operativo con intervención humana y conectores empresariales seguros.
- **Primer cliente integrado**: **SUMAK** (sistema multinivel, productos, inventario, academia, cursos, matrículas y pagos).
- **Principio rector**: SUMAK se conecta como el primer tenant mediante un adaptador aislado (`packages/integrations/src/sumak`). El núcleo de RSD Sync permanece 100% genérico y reutilizable para futuros clientes de RSD Solutions.

---

## 2. Catálogo Vivo de Funcionalidades de la Plataforma

| Módulo / Paquete | Estado Actual | ¿Qué hace? (Funcionalidad) | ¿Por qué existe? | ¿Cómo está implementado hoy? |
| --- | --- | --- | --- | --- |
| `@rsd-sync/shared` | **Activo (Fase 0)** | Define tipos nominales (`TenantId`, `UserId`, `CorrelationId`, `ExecutionId`), el patrón `Result<T, E>`, utilidades UTC y la jerarquía base de errores (`RsdError`, `ValidationError`, `TenantIsolationError`, `UnauthorizedOperationError`, `ExternalValidationRequiredError`). | Evitar errores de paso de identificadores entre tenants y estandarizar el manejo de errores en toda la plataforma. | Tipos con marca nominal (`Brand<T, Name>`) y clases tipadas en `packages/shared/src/index.ts`. |
| `@rsd-sync/contracts` | **Activo (Fase 0)** | Esquemas Zod y contratos compartidos: `TenantContextSchema`, `DomainEventEnvelopeSchema`, `ExecutionStatusSchema`, `ConversationModeSchema`, `ChannelTypeSchema`, `CommercialApprovalStatusSchema`, `PlatformRoleSchema`, `AiToolMetadataSchema`, `AiUsageMetricsSchema`. | Garantizar una única fuente de verdad entre API, Worker, Admin y paquetes de dominio con validación en runtime y compilación. | Esquemas Zod exportados en `packages/contracts/src/index.ts`. |
| `@rsd-sync/configuration` | **Activo (Fase 1)** | Carga y valida variables de entorno (`parsePlatformConfig`), resuelve el target de BD (`resolveEffectiveDatabaseConnection`: `local` vs `supabase`), valida `ADMIN_EMAILS`, carga `.env` en desarrollo local (`loadLocalEnvIfPresent`), impide llaves por defecto en producción y redacta secretos (`redactConfigForLogging`). | Centralizar configuración y garantizar separación segura entre entorno local Docker y credenciales cloud de Supabase/Vercel. | Esquema Zod `PlatformEnvSchema` (`superRefine` para producción) en `packages/configuration/src/index.ts`. |
| `@rsd-sync/observability` | **Activo (Fase 0)** | Logger JSON estructurado (`createLogger`) con propagación de `correlationId`/`tenantId`, sanitización recursiva (`sanitizeLogData`) y contratos de health checks. | Trazabilidad completa de eventos y garantías de que ningún token, contraseña o llave privada se imprima en consola. | Sanitizador recursivo con detección de claves sensibles y `WeakSet` contra referencias circulares en `packages/observability/src/index.ts`. |
| `@rsd-sync/security` | **Activo (Fase 0)** | Guardia de aislamiento por empresa (`assertTenantIsolation`), cifrado autenticado `AES-256-GCM` con AAD por tenant (`encryptSecret`/`decryptSecret`), verificación `HMAC-SHA256` en tiempo constante (`verifyHmacSignature`) y matriz RBAC (`canExecuteAction`). | Proteger datos entre empresas, cifrar credenciales de integraciones en reposo, autenticar webhooks y restringir permisos de humanos e IA. | Módulos en `packages/security/src/{tenants,secrets,authentication,authorization,policies}/` usando `node:crypto`. |
| `@rsd-sync/queue` | **Activo (Fase 1.4)** | Conecta con Redis (`ioredis`) y BullMQ 6 (`createTestJobsQueue/Worker`, `createWhatsappInboundQueue/Worker`, `createWhatsappOutboundQueue/Worker`), gestiona heartbeats de presencia del worker y mantiene el catálogo oficial de colas (`QUEUE_NAMES`) y backoff exponencial. | Desacoplar la recepción HTTP de la ejecución asíncrona y soportar el flujo completo de entrada/salida de mensajería WhatsApp. | `packages/queue/src/{index,connection,bullmq,whatsapp-jobs}.ts` usando `bullmq` e `ioredis`. |
| `@rsd-sync/database` | **Activo (Fase 1.4)** | Implementa `PostgresDatabaseClient` (`pg.Pool` con transacciones multi-tenant `app.current_tenant_id` y SSL automático para Supabase), `SupabaseConnector`, `BotOperationsRepository`, runner SQL y migraciones `0001`–`0003` (RLS + `pgvector` + tablas de canales/IA/CRM/aprobaciones + `rsd_sync_app`). | Operar sobre PostgreSQL local (`127.0.0.1:54332`) o el proyecto Supabase dedicado de RSD Sync sin tocar SUMAK. | `packages/database/src/{clients,migrations,repositories,schemas}/` y `packages/database/migrations/*.sql`. |
| `@rsd-sync/automation-core` | **Activo (Fase 0 — Reglas Base)** / *Motor persistente en Fase 2* | Creación de eventos (`createDomainEvent`), máquina de estados de ejecución (`transitionExecutionStatus`), registro de manejadores (`AutomationRegistry`), contratos de scheduler y clave de idempotencia SHA-256 (`computeIdempotencyKey`). | Evitar que webhooks duplicados disparen acciones repetidas y controlar el ciclo de vida de cada proceso empresarial. | Módulos en `packages/automation-core/src/{events,executions,registry,scheduler,engine}/`. |
| `@rsd-sync/ai-engine` | **Activo (Fase 1.4 — Proveedor Gemini + Retrieval)** / *Embeddings/RAG avanzado en Fase 5* | Interfaz agnóstica `AiModelProvider`, proveedor real `GeminiAiModelProvider` (REST API con redacción de clave), `selectRelevantKnowledgeSnippets`, plantillas, control de ventana/costos y guardia de herramientas (`AiToolGuard`). | Impedir dependencia de un solo proveedor LLM, conectar Gemini Flash y recuperar contexto verificado del tenant sin acoplar lógica comercial. | Módulos en `packages/ai-engine/src/{providers/gemini,agents,prompts,knowledge,retrieval,tools,context}/`. |
| `@rsd-sync/crm-core` | **Activo (Fase 1.4)** | Control de modo de conversación (`transitionConversationMode`: `AI`, `HUMAN`, `COPILOT`), pausa automática de IA cuando interviene una secretaria (`shouldAiAutoReply`), y resolución de aprobaciones comerciales (`resolveCommercialApproval`). | Permitir atención híbrida humano-IA donde la secretaria siempre tiene prioridad y las operaciones críticas requieren validación externa. | Módulos en `packages/crm-core/src/{contacts,conversations,messages,leads,opportunities,appointments,assignments,approvals}/`. |
| `apps/api` | **Activo (Fase 1.4)** | Servidor HTTP Fastify 5 con Helm/CORS, correlación, protección admin y endpoints `/health/*`, `/api/v1/status`, `/api/v1/jobs/*`, verificación webhook `GET/POST /api/v1/webhooks/whatsapp` (HMAC-SHA256), simulador firmado `/api/v1/simulator/whatsapp/inbound` y rutas CRM `/api/v1/conversations/*`. | Exponer el plano de control, ingestión WhatsApp verificada y gestión de conversaciones hacia Redis/BullMQ y PostgreSQL. | `apps/api/src/{server,index,middleware/admin-auth,routes/{health,v1,whatsapp,conversations}}.ts`. |
| `apps/worker` | **Activo (Fase 1.4)** | Proceso independiente conectado a Redis/BullMQ ejecutando `EVENTS`, `WHATSAPP_INBOUND` y `WHATSAPP_OUTBOUND` con idempotencia en BD, pausa automática `HUMAN`, compuerta `PENDING_VALIDATION`, generación con Gemini y despacho `local_http`/`cloud_api`. | Procesar mensajes e inferencia IA fuera del hilo HTTP garantizando reintentos seguros, idempotencia y reglas inviolables. | `apps/worker/src/{worker,index,processors/{test-job,whatsapp-inbound,whatsapp-outbound}}.ts`. |
| `apps/admin` | **Activo (Fase 1.4)** | Panel web en Next.js 16 + Tailwind CSS 4 + Lucide Icons listo para Vercel con vistas `Dashboard` (`/`), `WhatsApp & CRM` (`/conversations`), `Infraestructura` (`/infrastructure`), `Trabajos de prueba` (`/jobs`) y `/login` protegido por Supabase Auth + BFF (`/api/platform/*`). | Monitorear infraestructura, probar el bot mediante simulador HTTP local firmado, consultar hilos y tomar control humano desde navegador sin exponer secretos. | `apps/admin/src/{app,components,lib}/` usando `@supabase/ssr`. |

---

## 3. Catálogo Vivo de Integraciones Externas (`@rsd-sync/integrations`)

| Integración | Ubicación | Estado | Propósito y Reglas de Operación |
| --- | --- | --- | --- |
| **SUMAK** | `packages/integrations/src/sumak` | **Auditoría Read-Only + Conocimiento Base Activo (Fase 1.4)** / *Conexión RPC en Fase 4/8* | Conecta RSD Sync con la plataforma de **SUMAK** (16 productos, 3 packs, reglas MLM, Academia Salud Renal, cuentas bancarias). Sembrado local aislado mediante `pnpm seed:sumak` con compuerta obligatoria `PENDING_VALIDATION` para pagos/ventas/matrículas. |
| **WhatsApp Cloud API** | `packages/integrations/src/whatsapp` | **Activo en modo `local_http` + listo para `cloud_api` (Fase 1.4)** | Parser Zod de webhooks Meta (`parseMetaWhatsAppWebhookPayload`), generador de simulación firmado (`createLocalMetaWebhookPayload`), verificación HMAC-SHA256 y adaptador de envío (`WhatsAppCloudApiAdapter`). |
| **Generic API** | `packages/integrations/src/generic-api` | **Contrato Base (Fase 0)** / *Implementación en Fase 10* | Adaptador HTTP parametrizable para integrar sistemas ERP/CRM de futuros clientes sin modificar el núcleo de RSD Sync. |
| **Email** | `packages/integrations/src/email` | **Contrato Base (Fase 0)** / *Implementación en fases posteriores* | Envío de notificaciones transaccionales y alertas operativas por tenant. |

---

## 4. Bitácora Cronológica de Iteraciones

### Iteración 0.1 — Fundación Arquitectónica, Monorepo, Documentación y Contratos Base (2026-11-17)
- **¿Qué se hizo?**
  - Se inicializó el repositorio Git en `main` y el monorepo `pnpm` con 11 paquetes en `packages/*` y 3 aplicaciones en `apps/*`.
  - Se redactó la documentación fundacional (`AGENTS.md`, `README.md`, `ROADMAP.md` para Fases 0–10, `ARCHITECTURE.md`, `DECISIONS.md` con ADRs 001–006, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md` y guías en `docs/*`).
  - Se implementaron las utilidades compartidas, contratos Zod, cargador de configuración, logger con redacción de secretos, primitivas de seguridad (`AES-256-GCM`, `HMAC-SHA256`, RBAC, aislamiento de tenant), migración SQL `0001_phase0_foundation.sql`, guardias de IA (`AiToolGuard`), lógica de handoff humano (`transitionConversationMode`) y política invariante del adaptador **SUMAK** (`SUMAK_VALIDATION_POLICY`).
  - Se crearon 5 suites de pruebas automatizadas (17 tests) incluyendo verificación estática de fronteras arquitectónicas.
- **¿Por qué se hizo?**
  - Para establecer desde el primer día una arquitectura de nivel empresarial que separe el motor propio de RSD Solutions de las particularidades del primer cliente (SUMAK) y garantice seguridad multi-tenant por diseño.
- **¿Cómo se hizo?**
  - Mediante TypeScript estricto (`NodeNext`, `composite: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`), esquemas Zod, `node:crypto` nativo, Vitest y un script automatizado (`scripts/verify-foundation.mjs`).
- **Commits asociados**: `550fa4a`, `b67eb04`, `0d10cd4`, `393c651`, `c9a136c`.

### Iteración 0.2 — Configuración de Remoto GitHub, Aislamiento de Puerto `54332` y Levantamiento Docker Real (2026-11-17)
- **¿Qué se hizo?**
  - Se configuró el remoto `origin` hacia `https://github.com/rsdsolutionsec/RSD-Sync.git` y se estableció la política permanente de **push manual por parte del usuario** (el agente solo realiza commits locales verificados).
  - Se cambió el puerto local de `rsd-sync-postgres` de `54322` a **`127.0.0.1:54332`** y se levantaron en Docker Compose los contenedores `rsd-sync-redis` (`127.0.0.1:6379`) y `rsd-sync-postgres` (`127.0.0.1:54332`).
- **¿Por qué se hizo?**
  - Porque al inspeccionar Docker Desktop activo se detectó que `supabase_db_Sumak` ya ocupaba el puerto `54322`. Aislar RSD Sync en `54332` evita colisiones de red y previene cualquier conexión accidental a la base local de SUMAK.
- **¿Cómo se hizo?**
  - Actualizando `docker-compose.yml`, `.env.example`, `@rsd-sync/configuration`, pruebas y documentación; ejecutando `pnpm docker:up` y verificando en vivo `redis-cli ping` (`PONG`), extensiones `pgcrypto`/`vector`, tablas `tenants`/`audit_logs` y políticas RLS en PostgreSQL.
- **Commit asociado**: `548eb17`.

### Iteración 0.3 — Creación de Sistema de Contexto Continuo (`CONTEXT.md`) y Auditoría (`AUDIT.md`) (2026-11-17)
- **¿Qué se hizo?**
  - Se crearon `CONTEXT.md` y `AUDIT.md` en la raíz del repositorio y se actualizaron `AGENTS.md`, `README.md`, `CONTRIBUTING.md` y `scripts/verify-foundation.mjs` para exigir su actualización en cada iteración.
- **¿Por qué se hizo?**
  - Para mantener trazabilidad absoluta y comprensible en todo momento sobre **qué** se construye, **por qué** se toma cada decisión, **cómo** funciona cada módulo/integración y qué controles de auditoría se han verificado.
- **¿Cómo se hizo?**
  - Incorporando tablas vivas de funcionalidades e integraciones, bitácoras por iteración, matriz de auditoría y validación automática de existencia en `pnpm verify:foundation`.
- **Commit asociado**: `bef3025`.

### Iteración 1.1 — Fase 1: Runtime API Fastify, Worker BullMQ, Persistencia Supabase/PostgreSQL y Panel Next.js (2026-11-17)
- **¿Qué se hizo?**
  - Se extendió `@rsd-sync/configuration` y `.env` / `.env.example` con variables de Supabase dedicadas a **RSD Sync** (`RSD_DATABASE_URL`, `RSD_DATABASE_DIRECT_URL`, `DATABASE_TARGET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_*`, `ADMIN_EMAILS`, `ADMIN_API_KEY`, `APP_URL`, `API_URL`).
  - Se implementó el cliente real `PostgresDatabaseClient`, el conector `SupabaseConnector`, el runner de migraciones SQL y la migración `0002_phase1_supabase_hardening.sql` en `@rsd-sync/database`.
  - Se integró `ioredis` + `bullmq` en `@rsd-sync/queue`, se construyó la API Fastify (`apps/api`) con health checks y endpoints `/api/v1/status` y `/api/v1/jobs/*`, y se implementó el proceso independiente `apps/worker` con heartbeat en Redis y procesador de trabajos de prueba.
  - Se construyó el panel web en Next.js 16 + Tailwind CSS 4 + Lucide (`apps/admin`) con Dashboard, Infraestructura, Trabajos de prueba y `/login` protegido (Supabase Auth + `ADMIN_EMAILS` / gate local en desarrollo), más configuración `vercel.json` y guías operativas.
- **¿Por qué se hizo?**
  - Para transformar la fundación de Fase 0 en una plataforma ejecutable extremo a extremo (API <-> Redis/BullMQ <-> Worker <-> PostgreSQL/Supabase <-> Admin Web) manteniendo aislamiento total respecto a SUMAK.
- **¿Cómo se hizo?**
  - Reutilizando los paquetes de Fase 0 sin duplicar lógica, ejecutando un patrón BFF en Next.js (`/api/platform/*`) para no exponer secretos al navegador, y verificando RLS real con rol no superusuario (`rsd_sync_app`) y pruebas de integración reales contra Redis y PostgreSQL locales.
- **Archivos clave y commits**: `.env.example`, `packages/configuration`, `packages/database`, `packages/queue`, `apps/api`, `apps/worker`, `apps/admin`, `docs/phases/phase-1.md`, `docs/operations/vercel-deployment.md`; commits `ccf16fc`, `156bbc1`, `10b6aff`, `f8f7ff9`.

### Iteración 1.2 — Conexión Verificada con el Proyecto Supabase Propio de RSD Sync vía CLI (2026-11-17)
- **¿Qué se hizo?**
  - Se verificó la sesión de Supabase CLI en la organización `RSD Solutions Org` (totalmente separada de SUMAK) y el proyecto vinculado `RSD Sync` (`hsehkaojjxemdfgvejwm`, región `us-east-2`).
  - Se cargaron las llaves `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` en `.env` local (excluido de Git) sin imprimir secretos.
  - Se ejecutaron las migraciones `0001_phase0_foundation.sql` y `0002_phase1_supabase_hardening.sql` en el proyecto Supabase remoto y se registró su aplicación en `rsd_schema_migrations`.
- **¿Por qué se hizo?**
  - Para completar la conexión real de RSD Sync con su propia infraestructura cloud en Supabase y comprobar en vivo el esquema, extensiones y políticas de seguridad RLS.
- **¿Cómo se hizo?**
  - Mediante `supabase db query --linked`, `supabase projects api-keys` (escrito directamente a `.env`), `SupabaseConnector.checkConnectivity()` (`status: "connected"`, `416 ms`) y prueba de denegación REST para `anon` (`HTTP 401`).
- **Commit asociado**: `cabf1fa`.

### Iteración 1.3 — Endurecimiento de Supabase Auth (`disable_signup = true`) y Verificación de Usuario Administrador (2026-11-17)
- **¿Qué se hizo?**
  - Se verificó en `auth.users` del proyecto `RSD Sync` (`hsehkaojjxemdfgvejwm`) la existencia del usuario confirmado `admin@rsdsolutions.com` coincidente con `ADMIN_EMAILS`.
  - Se deshabilitó el registro público en `supabase/config.toml` (`enable_signup = false`, `minimum_password_length = 8`, `enable_confirmations = true`, MFA TOTP habilitado) y se aplicó al proyecto remoto mediante `supabase config push --yes`.
- **¿Por qué se hizo?**
  - Para impedir registros públicos indiscriminados en la instancia Supabase Auth de RSD Sync (defensa en profundidad adicional a `ADMIN_EMAILS`).
- **¿Cómo se hizo?**
  - Verificando en vivo `GET /auth/v1/settings` (`disable_signup: true`) y probando `POST /auth/v1/signup` con un correo no autorizado (`HTTP 422: Signups not allowed for this instance`).

### Iteración 1.4 — Vertical Slice Local Bot WhatsApp HTTP + Gemini AI + Conocimiento Auditado SUMAK + CRM Handoff (2026-11-18)
- **¿Qué se hizo?**
  - Se creó y aplicó la migración `0003_whatsapp_ai_crm_local.sql` (tablas multi-tenant con RLS forzado `channel_connections`, `ai_agents`, `knowledge_documents`, `contacts`, `conversations`, `messages`, `automation_executions`, `commercial_approvals` y funciones `resolve_channel_tenant` / `resolve_tenant_id_by_slug`) junto con `BotOperationsRepository`.
  - Se realizó una auditoría **en modo solo lectura** del repositorio local de SUMAK (`..\Sumak`) documentando 16 productos/precios, 3 packs, reglas MLM, Programa Academia Salud Renal (2 cursos) y cuentas bancarias oficiales en `docs/integrations/sumak-integration.md` y `packages/integrations/src/sumak/knowledge.ts`, manteniendo el núcleo 100% libre de lógica SUMAK.
  - Se implementó `GeminiAiModelProvider` (`packages/ai-engine/src/providers/gemini.ts`), `selectRelevantKnowledgeSnippets`, `WhatsAppCloudApiAdapter` + `parseMetaWhatsAppWebhookPayload` (`packages/integrations/src/whatsapp/cloud-api.ts`), colas `WHATSAPP_INBOUND` / `WHATSAPP_OUTBOUND`, rutas API firmadas con HMAC-SHA256, procesadores worker con idempotencia y escalación `PENDING_VALIDATION`, script `pnpm seed:sumak` y la vista `/conversations` en `apps/admin`.
- **¿Por qué se hizo?**
  - Para ejecutar y validar en entorno local el ciclo completo del bot de WhatsApp antes de exponer webhooks públicos en Meta Cloud API, garantizando respuestas basadas en la realidad auditada de SUMAK y bloqueo estricto de confirmaciones comerciales sin validación humana/SUMAK.
- **¿Cómo se hizo?**
  - Conservando el cuerpo crudo en Fastify para validar `x-hub-signature-256` en tiempo constante, ejecutando el simulador local contra el mismo endpoint webhook real, aislando cada entidad por `tenantId` en PostgreSQL RLS, y pausando automáticamente la IA (`mode = HUMAN`, `aiPaused = true`) cuando interviene un operador o se detecta un comprobante/pedido/matrícula.
- **Archivos clave**: `packages/database/migrations/0003_whatsapp_ai_crm_local.sql`, `packages/database/src/repositories/bot-operations.ts`, `packages/ai-engine/src/providers/gemini.ts`, `packages/integrations/src/whatsapp/cloud-api.ts`, `packages/integrations/src/sumak/knowledge.ts`, `packages/queue/src/whatsapp-jobs.ts`, `apps/api/src/routes/{whatsapp,conversations}.ts`, `apps/worker/src/processors/whatsapp-{inbound,outbound}.ts`, `apps/admin/src/app/conversations/page.tsx`, `scripts/seed-sumak-local.mjs`.

---

## 5. Plantilla Obligatoria para Futuras Iteraciones

Cada vez que se complete una tarea o iteración, añadir al final de la Sección 4 un bloque con este formato:

```markdown
### Iteración X.Y — <Título corto> (YYYY-MM-DD)
- **¿Qué se hizo?**: <Descripción concreta de módulos, endpoints, migraciones o flujos implementados>
- **¿Por qué se hizo?**: <Necesidad de negocio, seguridad o arquitectura que resuelve>
- **¿Cómo se hizo?**: <Patrones, librerías, contratos, validaciones y pruebas aplicadas>
- **Archivos clave y commit**: <Archivos principales tocados y hash/mensaje del commit>
```
