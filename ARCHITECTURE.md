# ARCHITECTURE.md — Arquitectura de RSD Sync

## 1. Estilo Arquitectónico: Monolito Modular + Workers Independientes

RSD Sync adopta un **monolito modular** implementado como monorepo `pnpm` con procesos de ejecución claramente separados:

- **`apps/api`**: Recepción de peticiones HTTP, webhooks externos (WhatsApp, integraciones), autenticación, autorización por tenant y despacho de eventos/trabajos hacia colas.
- **`apps/worker`**: Proceso independiente consumidor de Redis/BullMQ encargado de ejecutar automatizaciones, inferencia de IA, envío de mensajes, sincronizaciones y tareas programadas (scheduler).
- **`apps/admin`**: Panel web operativo multiempresa para administración de tenants, conversaciones (modos IA, Humano, Copiloto), aprobaciones comerciales, conocimiento y métricas.

Esta decisión evita la sobrecarga operativa de microservicios prematuros en la etapa inicial, manteniendo fronteras de compilación estrictas mediante paquetes internos en `packages/*`.

---

## 2. Grafo de Dependencias y Fronteras entre Paquetes

```text
apps/api, apps/worker, apps/admin
   ├── @rsd-sync/configuration, @rsd-sync/observability
   ├── @rsd-sync/security, @rsd-sync/database, @rsd-sync/queue
   ├── @rsd-sync/automation-core
   ├── @rsd-sync/ai-engine
   ├── @rsd-sync/crm-core
   └── @rsd-sync/integrations (whatsapp, sumak, generic-api, email)
          │
          ▼ (Todos dependen hacia abajo de contratos y utilidades compartidas)
   @rsd-sync/contracts  ──▶  @rsd-sync/shared
```

### Regla de Aislamiento de Adaptadores
- Ningún paquete del núcleo (`automation-core`, `ai-engine`, `crm-core`, `security`, `database`, `queue`) puede importar `@rsd-sync/integrations` ni referenciar entidades de negocio exclusivas de **SUMAK**.
- Las integraciones concretas implementan puertos/contratos genéricos y residen exclusivamente en `packages/integrations/*`.

---

## 3. Arquitectura Multiempresa (Multi-Tenant)

Cada empresa cliente posee su propio `TenantId` y configuración aislada:

1. **Propagación de contexto**: Toda solicitud autenticada o trabajo en cola porta un `TenantContext` validado con Zod (`tenantId`, `slug`, `planLimits`, `timezone`).
2. **Guardias de dominio**: `@rsd-sync/security` expone `assertTenantIsolation(contextTenantId, resourceTenantId)` para bloquear cualquier acceso cruzado antes de procesar o responder.
3. **Aislamiento en base de datos**:
   - Toda tabla multi-tenant incluye la columna `tenant_id` indexada.
   - PostgreSQL aplica políticas **Row Level Security (RLS)** apoyadas en la función `app_current_tenant_id()` (`current_setting('app.current_tenant_id', true)`), complementando la validación obligatoria en backend.
4. **Cifrado de secretos por cliente**: Las credenciales externas de cada tenant (tokens de WhatsApp, claves de API, llaves de SUMAK) se cifran con **AES-256-GCM** usando `@rsd-sync/security` antes de persistirse.

---

## 4. Procesamiento Asíncrono, Eventos e Idempotencia

1. Un evento entrante (ej. webhook de WhatsApp o evento programado) se valida en `apps/api`, se verifica su firma HMAC y se normaliza en un `DomainEventEnvelope`.
2. `@rsd-sync/automation-core` calcula una clave determinista de idempotencia (`computeIdempotencyKey`) para evitar ejecuciones duplicadas ante reintentos de red.
3. El trabajo se encola en Redis/BullMQ a través de `@rsd-sync/queue` con sobres tipados (`QueueJobEnvelope<T>`) y políticas de backoff exponencial.
4. `apps/worker` transiciona los estados de ejecución (`PENDING` -> `RUNNING` -> `COMPLETED` / `FAILED` / `DEAD_LETTER`) registrando auditoría y métricas de latencia.

---

## 5. Motor de Inteligencia Artificial Agnóstico de Proveedor

`@rsd-sync/ai-engine` desacopla la lógica conversacional del proveedor de LLM:

- **Proveedores intercambiables**: Interfaz `AiModelProvider` implementable para OpenAI, Anthropic, Google Gemini u otros modelos sin alterar el núcleo CRM ni las automatizaciones.
- **Control estricto de herramientas**: Toda herramienta que la IA pueda invocar pasa por `AiToolGuard`, el cual verifica:
  1. Que la herramienta esté registrada explícitamente.
  2. Que el tenant tenga habilitada esa capacidad.
  3. Que los argumentos cumplan el esquema Zod definido.
  4. Que las operaciones sensibles respeten las políticas de validación externa (ej. **SUMAK** debe validar pagos, inventario descontado, ventas o matrículas).
- **RAG multi-tenant**: Documentos e indexación vectorial (`pgvector`) filtrados estrictamente por `tenantId`.
- **Control de consumo**: Medición de tokens de entrada/salida y costo estimado por ejecución respecto a los límites del tenant.

---

## 6. Atención Comercial e Intervención Humana (`crm-core`)

Las conversaciones operan bajo una máquina de estados explícita (`ConversationMode`):

- **`AI`**: El agente responde automáticamente aplicando conocimiento y herramientas autorizadas.
- **`HUMAN`**: Una secretaria u operador toma el control de la conversación. Al transicionar a `HUMAN`, el sistema establece obligatoriamente `aiPaused = true`, impidiendo respuestas automáticas hasta una reanudación explícita.
- **`COPILOT`**: La IA sugiere borradores de respuesta y resúmenes al operador humano sin enviar mensajes autónomos al cliente final.

---

## 7. Despliegue Local vs Futuro Despliegue en VPS

- **Desarrollo local**: Docker Compose provee Redis (`127.0.0.1:6379`) y PostgreSQL 17 con `pgvector` (`127.0.0.1:54322`), mientras los procesos Node.js pueden correr en local o mediante el perfil `app`.
- **Producción futura (VPS)**: Empaquetado mediante los Dockerfiles en `infrastructure/docker/`, detrás de un reverse proxy con TLS/HTTPS, volúmenes persistentes respaldados y secretos inyectados en tiempo de ejecución.
