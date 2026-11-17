# DECISIONS.md — Registro de Decisiones Arquitectónicas (ADRs)

Este archivo documenta las decisiones técnicas fundamentales de **RSD Sync**, su contexto, alternativas evaluadas y consecuencias.

---

## ADR-001: Monolito Modular con Workers Independientes vs Microservicios / n8n

- **Estado**: Aceptada (Fase 0)
- **Contexto**: RSD Sync requiere alta cohesión entre eventos, CRM, motor de IA y adaptadores externos, manteniendo despliegue simple en desarrollo local y futura migración a VPS sin complejidad distribuida innecesaria.
- **Decisión**: Construir un monolito modular en monorepo (`apps/api`, `apps/worker`, `apps/admin`) respaldado por paquetes internos desacoplados (`packages/*`) y colas BullMQ sobre Redis.
- **Alternativas descartadas**:
  - *Microservicios independientes desde el día 1*: Introduce latencia de red, sobrecarga de despliegue, versionado distribuido y depuración costosa sin justificación de escala actual.
  - *n8n como núcleo del sistema*: Limita el control estricto de tipado, pruebas automatizadas, RLS multi-tenant, control fino de concurrencia e idempotencia propia de RSD Solutions.
- **Consecuencias**: Fronteras de módulos reforzadas por TypeScript y pruebas de arquitectura; posibilidad futura de extraer cualquier módulo a un servicio dedicado si la carga lo justifica.

---

## ADR-002: Monorepo `pnpm` + TypeScript Estricto (`NodeNext`) + Zod

- **Estado**: Aceptada (Fase 0)
- **Contexto**: Los contratos compartidos entre API, Worker, Panel Admin y adaptadores deben validarse tanto en tiempo de compilación como en tiempo de ejecución.
- **Decisión**: Utilizar `pnpm` workspaces, TypeScript con `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` y `composite: true`, junto con `Zod` como única fuente de verdad para validación en bordes y contratos.
- **Alternativas descartadas**:
  - *Repositorios separados*: Ralentiza la evolución de contratos compartidos entre API, Worker y dominio.
  - *JavaScript sin tipado estricto*: Riesgo inaceptable de errores de contrato en flujos multi-tenant y webhooks.
- **Consecuencias**: Detección temprana de incompatibilidades y compilación incremental ordenada por grafo de dependencias.

---

## ADR-003: Persistencia Local con PostgreSQL 17 + `pgvector` vs Supabase de Producción SUMAK

- **Estado**: Aceptada (Fase 0)
- **Contexto**: SUMAK cuenta con un proyecto Supabase en producción. RSD Sync necesita persistencia relacional, RLS y búsqueda vectorial local sin riesgo de contaminar o alterar datos productivos de SUMAK.
- **Decisión**: Utilizar una instancia local en Docker de `pgvector/pgvector:pg17` con migraciones SQL versionadas compatibles con PostgreSQL/Supabase y RLS habilitado desde la migración `0001`, vinculada a `127.0.0.1:54332` (puerto aislado de otros servicios locales como Supabase en `54322`). Prohibido usar el Supabase de producción de SUMAK para pruebas o desarrollo de RSD Sync.
- **Alternativas descartadas**:
  - *Conectar entorno local al Supabase de producción de SUMAK*: Riesgo crítico de corrupción de datos reales, violación de seguridad y acoplamiento del motor de RSD Sync a tablas de un solo cliente.
  - *Base de datos separada solo para vectores*: Duplica infraestructura operativa en local y VPS sin necesidad en esta etapa.
- **Consecuencias**: Entorno local 100% reproducible, offline-capable, con soporte nativo para RLS y embeddings vectoriales (`vector`) en una sola instancia PostgreSQL.

---

## ADR-004: Aislamiento Multiempresa por Defensa en Profundidad (Backend + RLS + Cifrado)

- **Estado**: Aceptada (Fase 0)
- **Contexto**: RSD Sync operará múltiples empresas clientes compartiendo plataforma. Una fuga de datos entre tenants o exposición de credenciales comprometería todo el negocio.
- **Decisión**: Combinar validación explícita de `TenantId` en la capa de dominio/aplicación (`assertTenantIsolation`), Row Level Security (RLS) en PostgreSQL (`app_current_tenant_id()`), y cifrado autenticado AES-256-GCM de secretos por tenant en reposo.
- **Alternativas descartadas**:
  - *Filtrado únicamente en frontend o en consultas manuales sin RLS*: Susceptible a errores humanos u omisiones de `WHERE tenant_id = ...`.
- **Consecuencias**: Cada repositorio y consulta debe recibir explícitamente `TenantId`, y las migraciones SQL incorporan políticas RLS desde su creación.

---

## ADR-005: Aislamiento Estricto del Adaptador SUMAK y Política de No-Confirmación Autónoma

- **Estado**: Aceptada (Fase 0)
- **Contexto**: SUMAK maneja inventario, precios, academia, cursos, matrículas y pagos reales. Un error de la IA al confirmar operaciones transaccionales generaría pérdidas financieras u operativas.
- **Decisión**: Encapsular toda comunicación con SUMAK en `packages/integrations/src/sumak`, operando inicialmente en modo solo lectura (Fase 4) y utilizando APIs/RPC autorizadas. Ningún agente de IA ni el núcleo de automatización puede marcar como confirmados pagos, ventas, inventario descontado ni matrículas completadas sin respuesta validada por SUMAK.
- **Alternativas descartadas**:
  - *Permitir acceso directo de la IA a SQL o tablas de Supabase de SUMAK*: Riesgo inaceptable de inyección lógica, bypass de reglas de negocio de SUMAK y acoplamiento irreversible.
- **Consecuencias**: El núcleo de RSD Sync permanece genérico y verificable mediante pruebas automatizadas de fronteras arquitectónicas.

---

## ADR-006: Motor de IA Agnóstico de Proveedores con Registro de Herramientas Autorizadas

- **Estado**: Aceptada (Fase 0)
- **Contexto**: El ecosistema de modelos LLM evoluciona rápidamente y cada cliente puede requerir distintos modelos por costo, latencia o capacidades.
- **Decisión**: Definir la interfaz `AiModelProvider` y el guardia `AiToolGuard` en `@rsd-sync/ai-engine`, manteniendo prompts, RAG, herramientas autorizadas y métricas de consumo bajo control del backend de RSD Sync.
- **Alternativas descartadas**:
  - *Acoplar la aplicación directamente al SDK de un único proveedor*: Dificulta la optimización de costos y genera dependencia tecnológica.
- **Consecuencias**: Posibilidad de incorporar adaptadores para OpenAI, Anthropic, Gemini o modelos locales en Fase 5 sin reescribir flujos de negocio.
