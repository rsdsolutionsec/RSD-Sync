# AUDIT.md — Registro Maestro de Auditoría Técnica, Seguridad y Calidad (RSD Sync)

Este documento registra el estado de auditoría continua de **RSD Sync** en materia de arquitectura, seguridad multiempresa, aislamiento del cliente **SUMAK**, infraestructura y pruebas automatizadas.

> **Regla obligatoria**: Todo agente o ingeniero debe actualizar este archivo al finalizar cada iteración o fase, registrando las verificaciones ejecutadas, los hallazgos detectados y cómo fueron mitigados.

---

## 1. Matriz de Controles Auditados (Estado Actual: Fase 0)

| ID Control | Categoría | Descripción del Control | Estado | Evidencia / Mecanismo de Verificación |
| --- | --- | --- | --- | --- |
| **AUD-ARCH-01** | Arquitectura | Aislamiento estricto del núcleo (`automation-core`, `ai-engine`, `crm-core`, `security`, `database`, `queue`) sin dependencias hacia `@rsd-sync/integrations` ni referencias a `SUMAK`. | **CUMPLIDO** | Prueba automatizada `tests/integration/architecture-boundaries.test.ts`. |
| **AUD-ARCH-02** | Nomenclatura | Uso exclusivo de la ortografía oficial **SUMAK** (nunca SUMAC en código, identificadores y contratos). | **CUMPLIDO** | Escaneo estático en `scripts/verify-foundation.mjs` y `architecture-boundaries.test.ts`. |
| **AUD-SEC-01** | Secretos | Ningún archivo `.env`, llave privada ni credencial real está rastreado en Git. | **CUMPLIDO** | Reglas en `.gitignore` + verificación `git ls-files` en `scripts/verify-foundation.mjs`. |
| **AUD-SEC-02** | Criptografía | Cifrado autenticado `AES-256-GCM` con IV aleatorio de 12 bytes y vinculación por `TenantId` (AAD) para secretos de integraciones. | **CUMPLIDO** | Implementado en `packages/security/src/secrets/index.ts` y probado en `tests/unit/security-and-isolation.test.ts`. |
| **AUD-SEC-03** | Webhooks | Verificación de firmas `HMAC-SHA256` en tiempo constante (`crypto.timingSafeEqual`). | **CUMPLIDO** | Implementado en `packages/security/src/policies/index.ts` y probado en `tests/unit/security-and-isolation.test.ts`. |
| **AUD-SEC-04** | Multi-Tenancy | Guardia en backend (`assertTenantIsolation`) + Row Level Security (`ENABLE` y `FORCE ROW LEVEL SECURITY`) en PostgreSQL. | **CUMPLIDO** | `packages/security/src/tenants/index.ts`, migración `0001_phase0_foundation.sql` y verificación en contenedor `rsd-sync-postgres`. |
| **AUD-SEC-05** | Observabilidad | Redacción automática de contraseñas, tokens, API keys y cabeceras `Authorization` en logs y vuelcos de configuración. | **CUMPLIDO** | `sanitizeLogData` y `redactConfigForLogging` probados en `tests/unit/configuration-and-observability.test.ts`. |
| **AUD-BIZ-01** | Gobernanza IA / SUMAK | Prohibición técnica de confirmar pagos, ventas, descuentos de inventario o matrículas completadas sin validación explícita de SUMAK. | **CUMPLIDO** | `SUMAK_VALIDATION_POLICY`, `assertSumakOperationValidated`, `AiToolGuard` y `resolveCommercialApproval` probados en suites unitarias y de contratos. |
| **AUD-BIZ-02** | Atención Humana | Pausa obligatoria de respuestas automáticas de IA (`aiPaused = true`) cuando una secretaria u operador pasa la conversación a modo `HUMAN` o `COPILOT`, e imposibilidad de que `AI_AGENT` reactive el modo `AI` por sí mismo. | **CUMPLIDO** | `transitionConversationMode` y `shouldAiAutoReply` probados en `tests/unit/crm-and-automation.test.ts`. |
| **AUD-INF-01** | Infraestructura Local | Todos los puertos expuestos en `docker-compose.yml` están vinculados exclusivamente a `127.0.0.1` y aislados de contenedores de SUMAK (`54332` en lugar de `54322`). | **CUMPLIDO** | Verificado por `scripts/verify-foundation.mjs` y `docker compose ps`. |

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
