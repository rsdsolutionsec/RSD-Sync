# AUDIT.md — Registro Maestro de Auditoría Técnica, Seguridad y Calidad (RSD Sync)

Este documento registra el estado de auditoría continua de **RSD Sync** en materia de arquitectura, seguridad multiempresa, aislamiento del cliente **SUMAK**, infraestructura y pruebas automatizadas.

> **Regla obligatoria**: Todo agente o ingeniero debe actualizar este archivo al finalizar cada iteración o fase, registrando las verificaciones ejecutadas, los hallazgos detectados y cómo fueron mitigados.

---

## 1. Matriz de Controles Auditados (Estado Actual: Fase 1)

| ID Control | Categoría | Descripción del Control | Estado | Evidencia / Mecanismo de Verificación |
| --- | --- | --- | --- | --- |
| **AUD-ARCH-01** | Arquitectura | Aislamiento estricto del núcleo (`automation-core`, `ai-engine`, `crm-core`, `security`, `database`, `queue`) sin dependencias hacia `@rsd-sync/integrations` ni referencias a `SUMAK`. | **CUMPLIDO** | Prueba automatizada `tests/integration/architecture-boundaries.test.ts`. |
| **AUD-ARCH-02** | Nomenclatura | Uso exclusivo de la ortografía oficial **SUMAK** (nunca SUMAC en código, identificadores y contratos). | **CUMPLIDO** | Escaneo estático en `scripts/verify-foundation.mjs` y `architecture-boundaries.test.ts`. |
| **AUD-SEC-01** | Secretos | Ningún archivo `.env`, llave privada ni credencial real está rastreado en Git; componentes cliente de `apps/admin` nunca referencian llaves privadas ni `service_role`. | **CUMPLIDO** | Reglas en `.gitignore`, `scripts/verify-foundation.mjs` y `tests/unit/admin-auth-and-security.test.ts`. |
| **AUD-SEC-02** | Criptografía | Cifrado autenticado `AES-256-GCM` con IV aleatorio de 12 bytes y vinculación por `TenantId` (AAD) para secretos de integraciones. | **CUMPLIDO** | Implementado en `packages/security/src/secrets/index.ts` y probado en `tests/unit/security-and-isolation.test.ts`. |
| **AUD-SEC-03** | Webhooks | Verificación de firmas `HMAC-SHA256` en tiempo constante (`crypto.timingSafeEqual`). | **CUMPLIDO** | Implementado en `packages/security/src/policies/index.ts` y probado en `tests/unit/security-and-isolation.test.ts`. |
| **AUD-SEC-04** | Multi-Tenancy | Guardia en backend (`assertTenantIsolation`) + Row Level Security (`ENABLE` y `FORCE ROW LEVEL SECURITY`) verificada con SQL real bajo rol no superusuario `rsd_sync_app`. | **CUMPLIDO** | Migraciones `0001` y `0002`, `withTenantTransaction` y prueba real en `tests/integration/database-and-rls.test.ts`. |
| **AUD-SEC-05** | Observabilidad | Redacción automática de contraseñas, tokens, API keys (`ADMIN_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) y cabeceras `Authorization` en logs y vuelcos de configuración. | **CUMPLIDO** | `sanitizeLogData` y `redactConfigForLogging` probados en `tests/unit/configuration-and-observability.test.ts`. |
| **AUD-SEC-06** | Protección Panel & API | Endpoints `/api/v1/*` protegidos (`Bearer` Supabase JWT o `x-admin-api-key`); `apps/admin` valida sesión en servidor, bloquea producción sin Supabase Auth (fail-closed) y restringe correos con `ADMIN_EMAILS`. | **CUMPLIDO** | `apps/api/src/middleware/admin-auth.ts`, `apps/admin/src/lib/auth.ts`, `tests/unit/admin-auth-and-security.test.ts` y `tests/integration/api-worker-bullmq.test.ts`. |
| **AUD-BIZ-01** | Gobernanza IA / SUMAK | Prohibición técnica de confirmar pagos, ventas, descuentos de inventario o matrículas completadas sin validación explícita de SUMAK. | **CUMPLIDO** | `SUMAK_VALIDATION_POLICY`, `assertSumakOperationValidated`, `AiToolGuard` y `resolveCommercialApproval` probados en suites unitarias y de contratos. |
| **AUD-BIZ-02** | Atención Humana | Pausa obligatoria de respuestas automáticas de IA (`aiPaused = true`) cuando una secretaria u operador pasa la conversación a modo `HUMAN` o `COPILOT`, e imposibilidad de que `AI_AGENT` reactive el modo `AI` por sí mismo. | **CUMPLIDO** | `transitionConversationMode` y `shouldAiAutoReply` probados en `tests/unit/crm-and-automation.test.ts`. |
| **AUD-INF-01** | Infraestructura Local | Todos los puertos expuestos en `docker-compose.yml` están vinculados exclusivamente a `127.0.0.1` y aislados de contenedores de SUMAK (`54332` en lugar de `54322`). | **CUMPLIDO** | Verificado por `scripts/verify-foundation.mjs` y `docker compose ps`. |
| **AUD-INF-02** | Runtime API-Worker | Flujo completo `Fastify API -> Redis/BullMQ -> Independent Worker` verificado (ejecución exitosa, fallo/reintentos, parada y reinicio de worker sin duplicación). | **CUMPLIDO** | Probado extremo a extremo en `tests/integration/api-worker-bullmq.test.ts`. |
| **AUD-CLD-01** | Supabase Cloud & Vercel | Proyecto Supabase propio de RSD Sync (`hsehkaojjxemdfgvejwm` en `RSD Solutions Org`, aislado de SUMAK) vinculado por CLI, migrado (`0001`, `0002`, `0003`), con `rowsecurity = true`, denegación REST `anon` (`HTTP 401`) y `SupabaseConnector` conectado (`status: "connected"`). Despliegue en Vercel preparado (`vercel.json`) pendiente de enlace en cuenta Vercel. | **VERIFICADO (SUPABASE) / PENDIENTE VERCEL** | `supabase db query --linked`, sonda `SupabaseConnector`, sonda HTTP `anon` (`401`). |
| **AUD-WA-01** | Webhooks & Idempotencia WhatsApp | Verificación `HMAC-SHA256` sobre cuerpo crudo (`x-hub-signature-256`) en `POST /api/v1/webhooks/whatsapp`, challenge `GET`, parser Zod Meta Cloud API, simulador local firmado y dedup atómica en `automation_executions` + `messages`. | **CUMPLIDO** | `apps/api/src/routes/whatsapp.ts`, `tests/unit/whatsapp-and-gemini.test.ts`, `tests/integration/whatsapp-bot-e2e.test.ts` (E2E real sobre Redis/PostgreSQL). |
| **AUD-AI-01** | Proveedor Gemini & Higiene | `GeminiAiModelProvider` envía la clave vía cabecera `x-goog-api-key` (nunca en URL) y redacta `[REDACTED_API_KEY]` en errores HTTP; `apps/admin/src/components` libre de referencias a secretos o SUMAK. | **CUMPLIDO** | `packages/ai-engine/src/providers/gemini.ts`, `tests/unit/whatsapp-and-gemini.test.ts`, `tests/unit/admin-auth-and-security.test.ts`. |

---

## 2. Bitácora de Hallazgos e Incidentes Detectados y Corregidos

### Hallazgo #01 — Exportación de tipos nominales `Brand<T, Name>` en fronteras `.d.ts` (2026-11-17)
- **Fase / Iteración**: Fase 0 — Iteración 0.1
- **Severidad**: Media (bloqueo de compilación TypeScript)
- **Descripción**: Al compilar `@rsd-sync/contracts` con `declaration: true` y Project References, TypeScript arrojó `TS4023` porque `Brand<T, Name>` utilizaba un `unique symbol` no exportado desde `@rsd-sync/shared`.
- **Resolución aplicada**: Se reemplazó la propiedad de marca en `packages/shared/src/index.ts` por una propiedad nominal inmutable tipada (`readonly __rsdBrand: Name`), manteniendo la incompatibilidad estricta entre tipos (`TenantId` vs `UserId` vs `string`) y permitiendo la emisión limpia de declaraciones `.d.ts` en los 14 proyectos del monorepo.
- **Estado**: **Cerrado y verificado** (`pnpm build` y `pnpm typecheck` con salida `0`).

### Hallazgo #02 — Colisión potencial de puerto `54322` con contenedor local `supabase_db_Sumak` (2026-11-17)
- **Fase / Iteración**: Fase 0 — Iteración 0.2
- **Severidad**: Alta (aislamiento de entorno y disponibilidad local)
- **Descripción**: Al iniciar Docker Desktop se detectó que el contenedor `supabase_db_Sumak` ya escuchaba en el puerto `54322`. Usar `54322` en `docker-compose.yml` habría provocado fallo al levantar `rsd-sync-postgres` o riesgo de conectar herramientas locales al contenedor equivocado.
- **Resolución aplicada**: Se reasignó el puerto local de `rsd-sync-postgres` a `127.0.0.1:54332` en `docker-compose.yml`, `.env.example`, `@rsd-sync/configuration`, pruebas y documentación. Se levantó el contenedor y se verificó su aislamiento.
- **Estado**: **Cerrado y verificado** (`rsd-sync-postgres` saludable en `127.0.0.1:54332->5432/tcp`).

### Hallazgo #03 — Desajuste de cuenta activa en GitHub CLI al hacer `git push` manual (2026-11-17)
- **Fase / Iteración**: Fase 0 — Iteración 0.2
- **Severidad**: Baja (configuración de credenciales Git del entorno de usuario)
- **Descripción**: El usuario obtuvo HTTP `403` al ejecutar `git push` hacia `https://github.com/rsdsolutionsec/RSD-Sync.git` porque el helper global `gh auth git-credential` tenía activa la cuenta `RSDsolutions` en lugar de `rsdsolutionsec`.
- **Resolución aplicada**: Se diagnosticó la causa exacta y se entregaron las opciones de autenticación (`gh auth login` con `rsdsolutionsec`, `credential.helper` local o permisos de colaborador) respetando la regla de push manual.
- **Estado**: **Documentado**.

### Hallazgo #04 — Consultas multi-sentencia en `node-postgres` (`pg`) durante migraciones SQL (2026-11-17)
- **Fase / Iteración**: Fase 1 — Iteración 1.1
- **Severidad**: Media (fallo al ejecutar migraciones SQL con múltiples sentencias)
- **Descripción**: `pg.Pool.query()` devuelve un arreglo de resultados cuando recibe un script SQL multi-sentencia sin parámetros, provocando `TypeError` al acceder directamente a `result.rows`.
- **Resolución aplicada**: Se normalizó `PostgresDatabaseClient.query()` y `tx.query()` para tomar el último elemento cuando `Array.isArray(result)` es verdadero.
- **Estado**: **Cerrado y verificado** (`pnpm db:migrate` y `tests/integration/database-and-rls.test.ts` en verde).

### Hallazgo #05 — Condición de carrera al consultar trabajos BullMQ recién completados (2026-11-17)
- **Fase / Iteración**: Fase 1 — Iteración 1.1
- **Severidad**: Media (posible `result: undefined` al consultar un trabajo justo en el instante de transición a `completed`)
- **Descripción**: `Job.fromId` lee el hash en Redis antes de que `job.getState()` confirme el estado final; si el worker completa el trabajo entre ambas lecturas, `state` figura como `completed` pero `returnvalue` aún estaba vacío en la copia inicial.
- **Resolución aplicada**: En `formatBullMqJob` (`packages/queue/src/bullmq.ts`), cuando `state` es `completed` sin `returnvalue` (o `failed` sin `failedReason`), se re-consulta automáticamente el `Job.fromId` actualizado.
- **Estado**: **Cerrado y verificado** (`tests/integration/api-worker-bullmq.test.ts` en verde).

### Hallazgo #06 — Desajuste de columnas en `audit_logs` durante `updateConversationMode` (2026-11-18)
- **Fase / Iteración**: Iteración 1.4
- **Severidad**: Alta (error HTTP `500` al cambiar modo de conversación a `HUMAN` en PostgreSQL real)
- **Descripción**: `BotOperationsRepository.updateConversationMode` referenciaba `actor_type` cuando el esquema real definido en `0001_phase0_foundation.sql` utiliza `actor_id`, `actor_role` y `correlation_id`.
- **Resolución aplicada**: Se alineó la sentencia `INSERT INTO audit_logs` con las columnas reales (`actor_id`, `actor_role`, `correlation_id`) recibiendo `actorRole` y `correlationId` desde la API y el Worker.
- **Estado**: **Cerrado y verificado** (`tests/integration/whatsapp-bot-e2e.test.ts` en verde).

### Hallazgo #07 — Disponibilidad del modelo `gemini-2.5-flash` vs `gemini-3.8-flash` (2026-11-18)
- **Fase / Iteración**: Iteración 1.4
- **Severidad**: Alta (error HTTP `404` en la API REST de Gemini para claves nuevas)
- **Descripción**: La sonda en vivo contra `generativelanguage.googleapis.com` usando `GOOGLE_GENAI_API_KEY` devolvió `404 NOT_FOUND` para `gemini-2.5-flash` indicando el uso obligatorio de `gemini-3.8-flash` para cuentas nuevas.
- **Resolución aplicada**: Se actualizó el modelo por defecto a `gemini-3.8-flash` en `.env`, `.env.example`, `@rsd-sync/configuration`, el seed de SUMAK (`pnpm seed:sumak`) y las pruebas; y se comprobó respuesta HTTP `200` en vivo sin exponer la clave.
- **Estado**: **Cerrado y verificado**.

### Hallazgo #08 — Interferencia paralela entre Workers BullMQ de distintas suites E2E (2026-11-18)
- **Fase / Iteración**: Iteración 1.4
- **Severidad**: Media (condición de carrera en pruebas cuando dos archivos lanzan workers sobre el mismo Redis)
- **Descripción**: Con `fileParallelism: true`, `api-worker-bullmq.test.ts` y `whatsapp-bot-e2e.test.ts` suscribían workers simultáneos a `rsd.whatsapp-inbound` en `127.0.0.1:6379`, robando trabajos entre suites.
- **Resolución aplicada**: Se configuró `fileParallelism: false` en `vitest.config.ts`.
- **Estado**: **Cerrado y verificado** (`10` suites / `36` pruebas en verde).

---

## 3. Auditoría Read-Only del Sistema Cliente SUMAK

Con el fin de alimentar la base de conocimiento del bot inicial sin acoplar el núcleo de RSD Sync, se auditó el repositorio local `..\Sumak` **en modo estrictamente de solo lectura** (sin modificar código ni conectar su base productiva):
1. **Identidad y canales**: `Sumak Vida Ecuador S.A.` (`SUMAK`, RUC `1291781000001`, Lab `Sumak Jambi`, Babahoyo).
2. **Catálogo y packs**: 16 referencias (`00001`–`00016`), 3 packs de ingreso (`Pack Básico` \$125, `Pack Emprendedor` \$225, `Pack Líder` \$525), 50% descuento distribuidor (salvo `00008 Formula 1000` \$60 PVP / \$20 fijo), activación \$100 y 14 niveles MLM (Tramo 1 y Tramo 2).
3. **Academia y pagos**: Programa *Especialización en Salud Renal y Terapia Botánica Andina* (Curso 1 180 min / 70%, Curso 2 240 min / 75%) y cuentas bancarias oficiales (Pichincha, Produbanco, Bolivariano).
4. **Entregable aislado**: Documentado en [docs/integrations/sumak-integration.md](./docs/integrations/sumak-integration.md) y encapsulado únicamente en `packages/integrations/src/sumak/knowledge.ts`. La conexión RPC/HTTP en tiempo real hacia SUMAK permanece reservada para las fases posteriores autorizadas.

---

## 4. Bitácora de Ejecuciones de Verificación y Pruebas

| Fecha (UTC-5) | Iteración | Comandos Ejecutados | Resultado Compilación / Tipos | Resultado Pruebas (`vitest`) | Resultado Infraestructura Docker |
| --- | --- | --- | --- | --- | --- |
| `2026-11-17` | `0.1` | `pnpm verify:foundation`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm docker:config` | `14/14` proyectos OK (`exit 0`) | `5` suites / `17` tests OK | `docker compose config -q` OK |
| `2026-11-17` | `0.2` | `pnpm docker:up`, `redis-cli ping`, `psql \dt & pg_policies`, `pnpm verify:foundation`, `pnpm build`, `pnpm typecheck`, `pnpm test` | `14/14` proyectos OK (`exit 0`) | `5` suites / `17` tests OK | `rsd-sync-redis` (`PONG`) y `rsd-sync-postgres` (`healthy`, RLS + `pgvector` activos) |
| `2026-11-17` | `0.3` | `pnpm verify:foundation`, `pnpm build`, `pnpm typecheck`, `pnpm test` | `14/14` proyectos OK (`exit 0`) | `5` suites / `17` tests OK | Contenedores activos y verificados |
| `2026-11-17` | `1.1` | `pnpm verify:foundation`, `pnpm build`, `pnpm typecheck`, `pnpm db:migrate`, `pnpm test`, `pnpm docker:config` | `14/14` proyectos OK (incl. Next.js 16 `apps/admin`) | `8` suites / `28` tests OK (incl. PostgreSQL RLS real y API-Redis-Worker E2E) | `rsd-sync-redis` y `rsd-sync-postgres` saludables con migraciones `0001` y `0002` |
| `2026-11-17` | `1.2` | `supabase db query --linked`, `SupabaseConnector.checkConnectivity()`, sonda REST `anon`, `pnpm verify:foundation`, `pnpm build`, `pnpm typecheck`, `pnpm test` | `14/14` proyectos OK (`exit 0`) | `8` suites / `28` tests OK | Supabase `RSD Sync` (`hsehkaojjxemdfgvejwm`) conectado (`416ms`), RLS activo, `anon` denegado (`401`) |
| `2026-11-17` | `1.3` | `supabase config push --yes`, sonda `auth.users`, `GET /auth/v1/settings`, `POST /auth/v1/signup`, `pnpm verify:foundation`, `pnpm test` | `14/14` proyectos OK (`exit 0`) | `8` suites / `28` tests OK | `disable_signup = true` verificado (`HTTP 422`), usuario `admin@rsdsolutions.com` confirmado |
| `2026-11-18` | `1.4` | `pnpm docker:up`, `pnpm db:migrate`, `pnpm seed:sumak`, `supabase db query --linked -f 0003`, sonda Gemini `gemini-3.8-flash`, `pnpm verify:foundation`, `pnpm build`, `pnpm typecheck`, `pnpm test` | `14/14` proyectos OK (incl. Next.js `/conversations` y 5 rutas BFF) | **`10` suites / `36` tests OK** (`whatsapp-bot-e2e`, `api-worker-bullmq`, `database-and-rls`, `architecture-boundaries`, `unit`, `contracts`) | `rsd-sync-postgres` (`0003` aplicada + tenant `sumak` sembrado) y `rsd-sync-redis` saludables; Supabase remoto `0003` aplicada |
