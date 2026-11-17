# ROADMAP.md — Plan Maestro de Desarrollo por Fases (RSD Sync)

Este documento define el plan completo de desarrollo de **RSD Sync** desde la **Fase 0** hasta la **Fase 10**, con entregables verificables, dependencias y criterios de aceptación por fase.

> **Estado general**: Fases 0 y 1 completadas (proyecto Supabase propio de **RSD Sync** vinculado y verificado vía CLI; pendiente enlace de Vercel y `RSD_DATABASE_URL` si se requiere pool Postgres directo en nube). Las capacidades de Fases 2–10 permanecen en diseño/contrato.

---

## Tabla Resumen de Fases

| Fase | Nombre | Estado | Dependencia Principal |
| --- | --- | --- | --- |
| **Fase 0** | Arquitectura y preparación | Completada | Ninguna |
| **Fase 1** | Infraestructura base | Completada (Supabase conectado; Vercel preparado) | Fase 0 |
| **Fase 2** | Automation Core | Pendiente | Fase 1 |
| **Fase 3** | Seguridad y multiempresa | Pendiente | Fase 2 |
| **Fase 4** | Auditoría e integración de SUMAK | Pendiente | Fase 3 |
| **Fase 5** | AI Engine | Pendiente | Fase 3, Fase 4 |
| **Fase 6** | WhatsApp | Pendiente | Fase 2, Fase 3 |
| **Fase 7** | CRM y atención humana | Pendiente | Fase 3, Fase 6 |
| **Fase 8** | Implementación SUMAK | Pendiente | Fases 4, 5, 6, 7 |
| **Fase 9** | Calidad y producción | Pendiente | Fase 8 |
| **Fase 10** | Estandarización comercial | Pendiente | Fase 9 |

---

## FASE 0 — Arquitectura y preparación

- **Objetivo**: Establecer la arquitectura completa del monolito modular, el monorepo pnpm + TypeScript estricto, la infraestructura Docker local, las reglas de gobernanza y la documentación base de RSD Sync.
- **Alcance**: Estructura de `apps/*`, `packages/*`, `infrastructure/*`, `docs/*`, `tests/*`; contratos base, guardias de aislamiento, políticas de seguridad, migración SQL `0001`, Docker Compose local (`redis` + `postgres/pgvector`) y pruebas de fronteras arquitectónicas. No incluye lógica HTTP runtime, conexión viva a Redis/PostgreSQL ni llamadas a APIs externas.
- **Dependencias**: Node.js LTS, pnpm, Git, Docker Desktop.
- **Tareas**:
  1. Verificar entorno local e inicializar repositorio Git en rama `main`.
  2. Configurar `pnpm-workspace.yaml`, `tsconfig.base.json`, `tsconfig.json`, `vitest.config.ts` y CI.
  3. Definir `docker-compose.yml` con puertos vinculados a `127.0.0.1` y volúmenes persistentes.
  4. Redactar toda la documentación raíz (`AGENTS.md`, `README.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`) y `docs/*`.
  5. Crear los paquetes base en `packages/*`, puntos de entrada en `apps/*` y Dockerfiles en `infrastructure/docker/`.
  6. Implementar pruebas unitarias, de contratos y de aislamiento arquitectónico.
- **Entregables**: Monorepo compilable, Docker Compose validado, documentación completa y suite de pruebas de Fase 0 aprobada.
- **Archivos afectados**: Configuración raíz, `docs/**`, `packages/**`, `apps/**`, `infrastructure/**`, `tests/**`, `scripts/verify-foundation.mjs`, `.github/workflows/ci.yml`.
- **Pruebas**: `pnpm verify:foundation`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm docker:config`.
- **Criterios de aceptación**: Compilación limpia sin errores, todas las pruebas verdes, verificación de ausencia de secretos rastreados y aislamiento total del núcleo respecto a SUMAK.
- **Riesgos**: Desajuste de resolución ESM/NodeNext entre paquetes del workspace; mitigado mediante `composite: true`, `references` y alias en Vitest.
- **Commit de cierre**: `test(foundation): add unit, contract, and architectural isolation test suites` (tras commits previos incrementales de Fase 0).

---

## FASE 1 — Infraestructura base

- **Objetivo**: Levantar el runtime operativo básico con servidor HTTP Fastify, proceso worker BullMQ sobre Redis, configuración centralizada, health checks, logs estructurados y primer flujo asíncrono verificado.
- **Alcance**: Conexión real API <-> Redis <-> Worker, manejo global de errores, trazabilidad por `correlationId`, endpoints `/health/live` y `/health/ready`, y un trabajo de prueba (`ping-job`) encolado desde la API y procesado por el worker.
- **Dependencias**: Fase 0 completada y Docker Compose activo (Redis y PostgreSQL).
- **Tareas**:
  1. Integrar Fastify en `apps/api` con validación Zod de esquemas HTTP y plugin de observabilidad.
  2. Integrar BullMQ y cliente Redis en `packages/queue` y `apps/worker` con cierre ordenado (`graceful shutdown`).
  3. Conectar `@rsd-sync/configuration` y `@rsd-sync/observability` (redacción de secretos) al arranque de `api` y `worker`.
  4. Implementar endpoints de salud (`/health/live`, `/health/ready`) y endpoint interno de prueba de trabajo.
  5. Escribir pruebas de integración API -> Redis -> Worker.
- **Entregables**: API Fastify y Worker BullMQ ejecutándose en local con logs JSON estructurados y health checks verificables.
- **Archivos afectados**: `apps/api/src/**`, `apps/worker/src/**`, `packages/queue/src/**`, `packages/observability/src/**`, `packages/configuration/src/**`, `tests/integration/**`.
- **Pruebas**: Pruebas unitarias de configuración/errores y pruebas de integración reales API-Redis-Worker.
- **Criterios de aceptación**: `GET /health/ready` reporta estado `healthy` con Redis conectado; un trabajo encolado vía API es consumido y completado por `apps/worker`.
- **Riesgos**: Fugas de conexiones Redis o cierres abruptos en Windows/Docker; mitigado con manejadores `SIGINT`/`SIGTERM` y timeouts de conexión.
- **Commit de cierre**: `feat(infra): complete phase 1 fastify api, bullmq worker, and health checks`

---

## FASE 2 — Automation Core

- **Objetivo**: Construir el motor propio de eventos, ejecuciones, reintentos, idempotencia, control de concurrencia, scheduler, dead-letter queue (DLQ) y auditoría persistente.
- **Alcance**: Implementación completa de `@rsd-sync/automation-core`, migraciones SQL para tablas de eventos/ejecuciones/auditoría y procesadores en `apps/worker`.
- **Dependencias**: Fase 1 completada.
- **Tareas**:
  1. Crear migración SQL para `domain_events`, `automation_executions`, `scheduled_jobs` y `dead_letter_events`.
  2. Implementar bus de eventos tipado, registro de flujos y motor de ejecución con máquina de estados estricta.
  3. Implementar bloqueo por clave de idempotencia y control de concurrencia por tenant.
  4. Implementar reintentos con backoff exponencial y enrutamiento a DLQ tras agotamiento.
  5. Implementar scheduler recurrente en `apps/worker`.
- **Entregables**: Motor de automatizaciones persistente, idempotente y auditable.
- **Archivos afectados**: `packages/automation-core/src/**`, `packages/database/migrations/**`, `packages/database/src/**`, `apps/worker/src/schedulers/**`, `tests/**`.
- **Pruebas**: Pruebas unitarias de transiciones de estado/idempotencia y pruebas de integración de reintentos y DLQ.
- **Criterios de aceptación**: Eventos duplicados con la misma clave no generan doble ejecución; trabajos fallidos reintentan según política y pasan a `DEAD_LETTER` con auditoría.
- **Riesgos**: Condiciones de carrera en ejecución concurrente; mitigado con restricciones únicas en PostgreSQL y locks en Redis.
- **Commit de cierre**: `feat(automation-core): implement event bus, idempotency, retries, scheduler, and dlq`

---

## FASE 3 — Seguridad y multiempresa

- **Objetivo**: Consolidar la capa multi-tenant con gestión de empresas, usuarios, roles, permisos RBAC, políticas RLS en PostgreSQL, cifrado de credenciales en reposo y auditoría de seguridad.
- **Alcance**: Autenticación JWT/sesión para API/Admin, contexto obligatorio de tenant por solicitud, repositorio de secretos cifrados y pruebas exhaustivas de no-fuga entre tenants.
- **Dependencias**: Fase 2 completada.
- **Tareas**:
  1. Crear migraciones SQL para `tenants`, `users`, `tenant_memberships`, `roles`, `tenant_secrets` con políticas RLS estrictas.
  2. Implementar middleware de autenticación y resolución de `TenantContext` en `apps/api`.
  3. Implementar servicio de gestión y rotación de secretos cifrados (AES-256-GCM) en `@rsd-sync/security`.
  4. Registrar eventos de auditoría ante cambios de permisos, accesos denegados y lectura/escritura de secretos.
  5. Construir suite de pruebas de aislamiento multi-tenant (Tenant A vs Tenant B).
- **Entregables**: Plataforma multiempresa segura y verificada contra accesos cruzados.
- **Archivos afectados**: `packages/security/src/**`, `packages/database/migrations/**`, `packages/database/src/**`, `apps/api/src/middleware/**`, `tests/**`.
- **Pruebas**: Pruebas de seguridad automatizadas validando bloqueo cross-tenant en API y RLS en PostgreSQL.
- **Criterios de aceptación**: Ningún endpoint ni consulta SQL permite leer o mutar datos de otro tenant; todos los secretos se almacenan cifrados y nunca aparecen en logs.
- **Riesgos**: Omisión del contexto `app.current_tenant_id` en sesiones de pool PostgreSQL; mitigado mediante wrapper transaccional obligatorio en `@rsd-sync/database`.
- **Commit de cierre**: `security(multi-tenant): enforce tenant isolation, rls policies, rbac, and secret encryption`

---

## FASE 4 — Auditoría e integración de SUMAK

- **Objetivo**: Auditar sin modificar el repositorio y esquema existente de **SUMAK**, documentar su arquitectura/entidades y construir el adaptador aislado en modo inicial de solo lectura.
- **Alcance**: Inspección de repositorio SUMAK, documentación completa del contrato en `docs/integrations/`, definición de interfaces e implementación de consultas autorizadas de solo lectura (productos, precios, inventario, cursos, matrículas, pagos) vía APIs/RPC autorizadas.
- **Dependencias**: Fase 3 completada y acceso de lectura al repositorio de SUMAK.
- **Tareas**:
  1. Inspeccionar arquitectura, tablas, relaciones, autenticación, roles, funciones RPC y Edge Functions de SUMAK (sin modificar SUMAK).
  2. Documentar hallazgos y límites operativos en `docs/integrations/sumak-integration.md`.
  3. Implementar cliente autenticado y adaptador `SumakIntegrationAdapter` dentro de `packages/integrations/src/sumak`.
  4. Implementar cache/rate-limiting y validación estricta de respuestas con Zod.
  5. Crear pruebas de contrato con fixtures simuladas (sin tocar producción de SUMAK).
- **Entregables**: Auditoría documentada de SUMAK y adaptador desacoplado de solo lectura probado.
- **Archivos afectados**: `docs/integrations/sumak-integration.md`, `packages/integrations/src/sumak/**`, `tests/contracts/**`, `tests/integration/**`.
- **Pruebas**: Pruebas de contrato Zod del adaptador SUMAK, pruebas de límites arquitectónicos y pruebas con mocks HTTP/RPC.
- **Criterios de aceptación**: Consultas de catálogo, disponibilidad, cursos, matrículas y estado de pagos funcionan en solo lectura usando credenciales por tenant; el núcleo de RSD Sync permanece 100% agnóstico a SUMAK.
- **Riesgos**: Cambios en RPC/Edge Functions de SUMAK o uso accidental de credenciales productivas; mitigado con contratos versionados y entorno mockeado en CI.
- **Commit de cierre**: `feat(integrations): audit SUMAK and implement read-only isolated adapter`

---

## FASE 5 — AI Engine

- **Objetivo**: Implementar el motor de IA multi-proveedor con gestión de agentes por tenant, prompts versionados, historial, base de conocimiento RAG con `pgvector`, registro/autorización de herramientas y control de costos.
- **Alcance**: Adaptadores para al menos dos proveedores LLM, pipeline de ingesta documental y embeddings, recuperación semántica filtrada por `tenantId`, ejecución de tools autorizadas vía `AiToolGuard` y tracking de consumo por tenant.
- **Dependencias**: Fases 3 y 4 completadas.
- **Tareas**:
  1. Crear migraciones SQL para `ai_agents`, `ai_prompts`, `knowledge_documents`, `knowledge_chunks` (`vector`), y `ai_usage_ledger`.
  2. Implementar adaptadores de modelos detrás de `AiModelProvider`.
  3. Implementar pipeline de chunking, embeddings y búsqueda vectorial RAG aislada por tenant.
  4. Implementar orquestador de tool calling con validación Zod, permisos por rol/tenant y bloqueo de acciones no autorizadas.
  5. Implementar presupuesto y límites de consumo por tenant.
- **Entregables**: Motor de IA funcional, auditable y con control de costos y herramientas.
- **Archivos afectados**: `packages/ai-engine/src/**`, `packages/database/migrations/**`, `apps/worker/src/processors/**`, `tests/**`.
- **Pruebas**: Pruebas unitarias de `AiToolGuard`, presupuesto de costos, proveedores mockeados e integración RAG multi-tenant.
- **Criterios de aceptación**: La IA responde usando RAG del tenant correspondiente, solo ejecuta tools autorizadas y detiene inferencias cuando se excede el límite configurado del tenant.
- **Riesgos**: Alucinaciones o intentos de confirmar operaciones críticas; mitigado mediante prompts de sistema estrictos, schemas de salida y validación backend de tools.
- **Commit de cierre**: `feat(ai-engine): implement multi-provider orchestration, tenant rag, tool guard, and cost ledger`

---

## FASE 6 — WhatsApp

- **Objetivo**: Integrar el canal oficial WhatsApp Cloud API con verificación de firma HMAC, ingestión de webhooks, envío de mensajes y plantillas, manejo de adjuntos, ventana de 24h e idempotencia.
- **Alcance**: Endpoints webhook en `apps/api`, adaptador en `packages/integrations/src/whatsapp`, procesadores entrantes/salientes en `apps/worker` y pruebas con túnel HTTPS local para desarrollo.
- **Dependencias**: Fases 2 y 3 completadas.
- **Tareas**:
  1. Implementar verificación de reto GET y validación de firma `X-Hub-Signature-256` en webhook de Meta.
  2. Normalizar mensajes entrantes, estados de entrega y adjuntos hacia eventos de `automation-core`.
  3. Implementar adaptador de envío (texto, plantillas aprobadas, multimedia) respetando ventana de atención de 24 horas y rate limits.
  4. Persistir mensajes y estados en `crm-core` con idempotencia por `whatsapp_message_id`.
  5. Documentar flujo de pruebas locales con túnel HTTPS temporal.
- **Entregables**: Canal WhatsApp bidireccional seguro e idempotente.
- **Archivos afectados**: `packages/integrations/src/whatsapp/**`, `apps/api/src/routes/**`, `apps/worker/src/processors/**`, `docs/integrations/**`, `tests/**`.
- **Pruebas**: Pruebas de verificación HMAC, payloads webhook reales anonimizados, idempotencia de mensajes duplicados y manejo de errores API.
- **Criterios de aceptación**: Webhooks sin firma válida son rechazados con HTTP 401; mensajes válidos crean/actualizan conversaciones y generan respuestas asíncronas sin duplicados.
- **Riesgos**: Reintentos agresivos de Meta ante latencia; mitigado respondiendo HTTP 200 inmediato tras validar firma y encolar en Redis.
- **Commit de cierre**: `feat(whatsapp): integrate cloud api webhooks, signature verification, and outbound messaging`

---

## FASE 7 — CRM y atención humana

- **Objetivo**: Construir el módulo CRM operativo y el panel administrativo Next.js para gestionar contactos, conversaciones, prospectos, oportunidades, citas, asignaciones, aprobaciones y modos IA / Humano / Copiloto.
- **Alcance**: Backend completo de `@rsd-sync/crm-core`, endpoints REST autenticados en `apps/api` y aplicación web `apps/admin` (Next.js + Tailwind CSS + Lucide Icons).
- **Dependencias**: Fases 3 y 6 completadas.
- **Tareas**:
  1. Crear migraciones SQL para `contacts`, `conversations`, `messages`, `leads`, `opportunities`, `appointments`, `assignments` y `commercial_approvals`.
  2. Implementar endpoints de bandeja de entrada, asignación a secretarias/asesores, pausa/reanudación de IA y aprobaciones comerciales.
  3. Construir interfaz administrativa en `apps/admin` con autenticación segura (sin credenciales administrativas globales en cliente).
  4. Implementar vistas de conversación en tiempo real/polling controlado con conmutador `AI` / `HUMAN` / `COPILOT`.
  5. Probar flujos completos de derivación humana y pausa garantizada de IA.
- **Entregables**: CRM operativo y panel administrativo funcional multi-tenant.
- **Archivos afectados**: `packages/crm-core/src/**`, `packages/database/migrations/**`, `apps/api/src/routes/**`, `apps/admin/src/**`, `tests/**`.
- **Pruebas**: Pruebas unitarias de máquina de estados CRM, integración API-DB-RLS y pruebas E2E de intervención humana.
- **Criterios de aceptación**: Al tomar control una secretaria (`HUMAN`), ningún evento entrante dispara respuesta automática de IA hasta reactivación explícita.
- **Riesgos**: Desincronización de estado entre operador humano y worker de IA; mitigado verificando estado transaccional de conversación justo antes de enviar respuesta IA.
- **Commit de cierre**: `feat(crm): deliver crm core workflows and nextjs admin panel with human takeover`

---

## FASE 8 — Implementación SUMAK

- **Objetivo**: Poner en operación el primer caso de uso real para **SUMAK**: agente comercial y académico por WhatsApp integrado mediante su adaptador dedicado, con derivación a secretaría y solicitudes comerciales controladas.
- **Alcance**: Configuración del tenant SUMAK, carga de base de conocimiento institucional, habilitación de herramientas SUMAK (productos, precios, inventario, cursos, matrículas, estado de pagos), registro de prospectos y derivación a secretaría.
- **Dependencias**: Fases 4, 5, 6 y 7 completadas.
- **Tareas**:
  1. Configurar tenant SUMAK, credenciales cifradas y prompts especializados (ventas multinivel + academia).
  2. Indexar documentos oficiales de SUMAK en la base de conocimiento RAG del tenant.
  3. Conectar tools de consulta SUMAK y flujo de registro de solicitudes comerciales / pre-matrículas pendientes de validación.
  4. Configurar reglas de escalamiento automático a secretaría (pagos complejos, reclamos, cierre de matrícula/venta).
  5. Ejecutar simulaciones completas de conversaciones reales y ajustar prompts/umbrales.
- **Entregables**: Solución comercial SUMAK operando de extremo a extremo sobre RSD Sync en entorno controlado.
- **Archivos afectados**: `packages/integrations/src/sumak/**`, `docs/integrations/sumak-integration.md`, configuración seed de SUMAK (sin secretos), `tests/e2e/**`.
- **Pruebas**: Suite E2E de conversaciones reales (productos, inventario, cursos, matrículas, pagos, handoff a secretaría) y verificación de no-confirmación autónoma.
- **Criterios de aceptación**: La IA responde con exactitud basada en datos de SUMAK, deriva correctamente a secretaría pausándose, y nunca confirma pagos/ventas/inventario/matrículas sin validación externa de SUMAK.
- **Riesgos**: Respuestas ambiguas ante stock cambiante o pagos pendientes; mitigado con disclaimers transaccionales obligatorios y derivación humana ante duda.
- **Commit de cierre**: `feat(sumak): complete end-to-end whatsapp commercial and academy workflow`

---

## FASE 9 — Calidad y producción

- **Objetivo**: Endurecer la plataforma en seguridad, rendimiento, concurrencia, monitoreo, backups, recuperación ante desastres y empaquetado Docker para despliegue controlado en VPS.
- **Alcance**: Suite E2E completa, pruebas de carga y concurrencia, configuración de reverse proxy HTTPS, scripts de backup/restore de PostgreSQL y Redis, alertas y runbooks operativos.
- **Dependencias**: Fase 8 completada.
- **Tareas**:
  1. Ejecutar pruebas de carga, concurrencia de colas y resiliencia ante caídas de Redis/DB/proveedores IA.
  2. Realizar auditoría de seguridad (OWASP API Top 10, headers, rate limiting, validación de firmas, RLS).
  3. Configurar reverse proxy (Caddy/Nginx/Traefik) con TLS y plantillas de despliegue en `infrastructure/`.
  4. Implementar scripts automatizados de backup cifrado y pruebas de restauración.
  5. Redactar runbooks de operación, monitoreo y respuesta a incidentes.
- **Entregables**: Plataforma endurecida y lista para despliegue reproducible en VPS mediante Docker Compose.
- **Archivos afectados**: `infrastructure/**`, `docs/operations/**`, `docs/security/**`, `tests/e2e/**`, `scripts/**`.
- **Pruebas**: Pruebas de seguridad, carga, recuperación de backup y smoke tests post-despliegue.
- **Criterios de aceptación**: Cero vulnerabilidades críticas abiertas, restauración verificada desde backup, despliegue reproducible con variables de entorno y HTTPS activo.
- **Riesgos**: Saturación de memoria en Redis o crecimiento no acotado de logs; mitigado con políticas de retención, límites de memoria y rotación.
- **Commit de cierre**: `chore(production): harden security, backups, observability, and vps deployment`

---

## FASE 10 — Estandarización comercial

- **Objetivo**: Convertir RSD Sync en una plataforma comercializable llave en mano para incorporar nuevos clientes de RSD Solutions sin modificar el código núcleo.
- **Alcance**: Flujo de onboarding de nuevos tenants, plantillas reutilizables de agentes e integraciones, dashboard de métricas y consumo por empresa, gestión de cuotas/límites y documentación comercial/técnica de alta de clientes.
- **Dependencias**: Fase 9 completada.
- **Tareas**:
  1. Implementar flujo guiado de onboarding de nuevos tenants (identidad, roles iniciales, límites, canales).
  2. Crear sistema de plantillas de agentes y prompts parametrizables por industria/cliente.
  3. Implementar panel de métricas, consumo de IA/mensajes y alertas de cuota por empresa en `apps/admin`.
  4. Estandarizar incorporación de nuevos adaptadores mediante `generic-api` y contratos documentados.
  5. Validar alta completa de un segundo cliente de prueba (no SUMAK) sin tocar paquetes núcleo.
- **Entregables**: Plataforma multiempresa estandarizada y validada con onboarding de cliente adicional.
- **Archivos afectados**: `apps/admin/src/**`, `apps/api/src/modules/**`, `packages/integrations/src/generic-api/**`, `packages/configuration/**`, `docs/**`, `tests/**`.
- **Pruebas**: Prueba E2E de creación de nuevo tenant desde cero, asignación de plantilla de agente, aplicación de límites de uso y aislamiento respecto a SUMAK.
- **Criterios de aceptación**: Un nuevo cliente puede configurarse completamente vía administración/configuración sin modificar código de `automation-core`, `ai-engine` ni `crm-core`.
- **Riesgos**: Filtración de supuestos de SUMAK en plantillas genéricas; mitigado validando plantillas con datos de clientes heterogéneos.
- **Commit de cierre**: `feat(platform): standardize multi-tenant onboarding, agent templates, and usage governance`
