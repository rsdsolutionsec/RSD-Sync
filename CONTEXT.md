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
| `@rsd-sync/configuration` | **Activo (Fase 0)** | Carga y valida variables de entorno (`parsePlatformConfig`), impide llaves por defecto inseguras en producción y redacta secretos (`redactConfigForLogging`). | Evitar arranques con configuración inválida y prevenir filtración de credenciales en logs de diagnóstico. | Validación con `PlatformEnvSchema` (`superRefine` para `production`) y enmascarado de URLs/llaves en `packages/configuration/src/index.ts`. |
| `@rsd-sync/observability` | **Activo (Fase 0)** | Logger JSON estructurado (`createLogger`) con propagación de `correlationId`/`tenantId`, sanitización recursiva (`sanitizeLogData`) y contratos de health checks. | Trazabilidad completa de eventos y garantías de que ningún token, contraseña o llave privada se imprima en consola. | Sanitizador recursivo con detección de claves sensibles y `WeakSet` contra referencias circulares en `packages/observability/src/index.ts`. |
| `@rsd-sync/security` | **Activo (Fase 0)** | Guardia de aislamiento por empresa (`assertTenantIsolation`), cifrado autenticado `AES-256-GCM` con AAD por tenant (`encryptSecret`/`decryptSecret`), verificación `HMAC-SHA256` en tiempo constante (`verifyHmacSignature`) y matriz RBAC (`canExecuteAction`). | Proteger datos entre empresas, cifrar credenciales de integraciones en reposo, autenticar webhooks y restringir permisos de humanos e IA. | Módulos en `packages/security/src/{tenants,secrets,authentication,authorization,policies}/` usando `node:crypto`. |
| `@rsd-sync/queue` | **Activo (Fase 0 — Contratos)** / *Runtime en Fase 1* | Define el catálogo oficial de colas (`QUEUE_NAMES`), el sobre tipado `QueueJobEnvelope<T>` y el cálculo de backoff exponencial (`computeExponentialBackoffMs`). | Desacoplar la recepción HTTP de la ejecución pesada (IA, automatizaciones, envíos WhatsApp) y manejar reintentos ordenados. | Contratos en `packages/queue/src/index.ts`; conexión BullMQ viva programada para Fase 1. |
| `@rsd-sync/database` | **Activo (Fase 0 — Contratos + SQL 0001)** | Contratos `DatabaseClient`, `TenantRepository<T>` y migración SQL inicial `0001_phase0_foundation.sql` ejecutada en PostgreSQL 17 con `pgcrypto`, `vector`, `tenants`, `audit_logs` y políticas RLS forzadas. | Garantizar aislamiento multi-tenant a nivel de motor de base de datos y soporte vectorial para RAG en una sola instancia. | Interfaces en `packages/database/src/` y script SQL en `packages/database/migrations/0001_phase0_foundation.sql`. |
| `@rsd-sync/automation-core` | **Activo (Fase 0 — Reglas Base)** / *Motor persistente en Fase 2* | Creación de eventos (`createDomainEvent`), máquina de estados de ejecución (`transitionExecutionStatus`), registro de manejadores (`AutomationRegistry`), contratos de scheduler y clave de idempotencia SHA-256 (`computeIdempotencyKey`). | Evitar que webhooks duplicados disparen acciones repetidas y controlar el ciclo de vida de cada proceso empresarial. | Módulos en `packages/automation-core/src/{events,executions,registry,scheduler,engine}/`. |
| `@rsd-sync/ai-engine` | **Activo (Fase 0 — Contratos y Guardias)** / *Proveedores y RAG en Fase 5* | Interfaz agnóstica `AiModelProvider`, plantillas de prompts (`renderPromptTemplate`), contratos de documentos/embeddings/RAG, control de ventana y costos (`trimConversationContext`, `isDailyCostLimitExceeded`) y guardia de herramientas (`AiToolGuard`). | Impedir dependencia de un solo proveedor LLM y asegurar que la IA solo ejecute herramientas registradas, habilitadas para el tenant y validadas por esquema y permisos. | Módulos en `packages/ai-engine/src/{providers,agents,prompts,knowledge,retrieval,tools,context}/`. |
| `@rsd-sync/crm-core` | **Activo (Fase 0 — Reglas de Dominio)** / *API y UI en Fase 7* | Control de modo de conversación (`transitionConversationMode`: `AI`, `HUMAN`, `COPILOT`), pausa automática de IA cuando interviene una secretaria (`shouldAiAutoReply`), y resolución de aprobaciones comerciales (`resolveCommercialApproval`). | Permitir atención híbrida humano-IA donde la secretaria siempre tiene prioridad y las operaciones críticas requieren validación externa. | Módulos en `packages/crm-core/src/{contacts,conversations,messages,leads,opportunities,appointments,assignments,approvals}/`. |
| `apps/api` | **Preparado (Fase 0)** / *Fastify HTTP en Fase 1* | Punto de entrada y descriptores de rutas de salud (`/health/live`, `/health/ready`), cabeceras de frontera (`x-tenant-id`, `x-correlation-id`) y módulos HTTP. | Exponer webhooks y API REST autenticada bajo Fastify. | Bootstrap tipado en `apps/api/src/`. |
| `apps/worker` | **Preparado (Fase 0)** / *BullMQ Worker en Fase 1* | Punto de entrada y descriptores de suscripción a las 6 colas estándar y scheduler. | Procesar trabajos asíncronos fuera del hilo HTTP principal. | Bootstrap tipado en `apps/worker/src/`. |
| `apps/admin` | **Preparado (Fase 0)** / *Next.js UI en Fase 7* | Punto de entrada y definición de módulos operativos (`inbox`, `contacts`, `leads-and-opportunities`, `approvals`, `knowledge-base`, `automations`, `tenant-settings`) sin secretos administrativos en navegador. | Proveer bandeja de atención para secretarias, operadores y administradores de cada empresa. | Bootstrap tipado en `apps/admin/src/`. |

---

## 3. Catálogo Vivo de Integraciones Externas (`@rsd-sync/integrations`)

| Integración | Ubicación | Estado | Propósito y Reglas de Operación |
| --- | --- | --- | --- |
| **SUMAK** | `packages/integrations/src/sumak` | **Contrato y Políticas Activas (Fase 0)** / *Auditoría y lectura en Fase 4* / *Flujo completo en Fase 8* | Conecta RSD Sync con la plataforma de **SUMAK** (productos, precios, inventario, cursos, matrículas, pagos). Aplica `SUMAK_VALIDATION_POLICY` y `assertSumakOperationValidated`: **prohibido confirmar pagos, ventas, descuentos de inventario o matrículas completadas sin validación explícita de SUMAK**. |
| **WhatsApp Cloud API** | `packages/integrations/src/whatsapp` | **Contrato Base (Fase 0)** / *Implementación en Fase 6* | Recepción de webhooks verificados con HMAC-SHA256, envío de mensajes de texto y plantillas respetando la ventana de 24 horas e idempotencia por mensaje. |
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
