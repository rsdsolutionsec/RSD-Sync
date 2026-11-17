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
| **AUD-CLD-01** | Supabase Cloud & Vercel | Proyecto Supabase propio de RSD Sync (`hsehkaojjxemdfgvejwm` en `RSD Solutions Org`, aislado de SUMAK) vinculado por CLI, migrado (`0001` y `0002`), con `rowsecurity = true`, denegación REST `anon` (`HTTP 401`) y `SupabaseConnector` conectado (`status: "connected"`). Despliegue en Vercel preparado (`vercel.json`) pendiente de enlace en cuenta Vercel. | **VERIFICADO (SUPABASE) / PENDIENTE VERCEL** | `supabase db query --linked`, sonda `SupabaseConnector`, sonda HTTP `anon` (`401`). |

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

---

## 3. Auditoría Programada del Sistema Cliente SUMAK (Pendiente para Fase 4)

Conforme al plan maestro ([ROADMAP.md](./ROADMAP.md)), la auditoría de lectura sobre el repositorio y esquema de **SUMAK** se ejecutará en la **Fase 4** bajo las siguientes reglas estrictas:
1. **Solo lectura**: Prohibido modificar archivos o ejecutar migraciones sobre el repositorio o base de datos productiva de SUMAK.
2. **Alcance de inspección**:
   - Arquitectura general y stack de la aplicación SUMAK.
   - Esquema de tablas y relaciones en Supabase (multinivel, productos, inventario, precios, academia, cursos, matrículas, pagos, usuarios y roles).
   - Políticas RLS existentes, funciones RPC y Edge Functions disponibles.
   - Endpoints o mecanismos de validación de operaciones comerciales y académicas.
3. **Entregable de auditoría**: Los resultados detallados se registrarán en esta sección y en [docs/integrations/sumak-integration.md](./docs/integrations/sumak-integration.md) antes de codificar las consultas reales del adaptador.

---

## 4. Bitácora de Ejecuciones de Verificación y Pruebas

| Fecha (UTC-5) | Iteración | Comandos Ejecutados | Resultado Compilación / Tipos | Resultado Pruebas (`vitest`) | Resultado Infraestructura Docker |
| --- | --- | --- | --- | --- | --- |
| `2026-11-17` | `0.1` | `pnpm verify:foundation`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm docker:config` | `14/14` proyectos OK (`exit 0`) | `5` suites / `17` tests OK | `docker compose config -q` OK |
| `2026-11-17` | `0.2` | `pnpm docker:up`, `redis-cli ping`, `psql \dt & pg_policies`, `pnpm verify:foundation`, `pnpm build`, `pnpm typecheck`, `pnpm test` | `14/14` proyectos OK (`exit 0`) | `5` suites / `17` tests OK | `rsd-sync-redis` (`PONG`) y `rsd-sync-postgres` (`healthy`, RLS + `pgvector` activos) |
| `2026-11-17` | `0.3` | `pnpm verify:foundation`, `pnpm build`, `pnpm typecheck`, `pnpm test` | `14/14` proyectos OK (`exit 0`) | `5` suites / `17` tests OK | Contenedores activos y verificados |
| `2026-11-17` | `1.1` | `pnpm verify:foundation`, `pnpm build`, `pnpm typecheck`, `pnpm db:migrate`, `pnpm test`, `pnpm docker:config` | `14/14` proyectos OK (incl. Next.js 16 `apps/admin`) | `8` suites / `28` tests OK (incl. PostgreSQL RLS real y API-Redis-Worker E2E) | `rsd-sync-redis` y `rsd-sync-postgres` saludables con migraciones `0001` y `0002` |
| `2026-11-17` | `1.2` | `supabase db query --linked`, `SupabaseConnector.checkConnectivity()`, sonda REST `anon`, `pnpm verify:foundation`, `pnpm build`, `pnpm typecheck`, `pnpm test` | `14/14` proyectos OK (`exit 0`) | `8` suites / `28` tests OK | Supabase `RSD Sync` (`hsehkaojjxemdfgvejwm`) conectado (`416ms`), RLS activo, `anon` denegado (`401`) |
