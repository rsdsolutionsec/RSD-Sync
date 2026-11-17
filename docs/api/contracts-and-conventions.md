# Contratos y Convenciones de API — RSD Sync

Este documento define las convenciones que regirán los contratos compartidos (`@rsd-sync/contracts`) y la capa HTTP (`apps/api`) desde la Fase 1 en adelante.

---

## 1. Validación en Fronteras con Zod

- Todo payload HTTP entrante (body, query, params), evento de dominio, trabajo en cola BullMQ y respuesta de adaptador externo debe validarse con un esquema **Zod**.
- Los tipos TypeScript se derivan con `z.infer<typeof Schema>` para garantizar una única fuente de verdad.

---

## 2. Estructura Estándar de Sobres y Contexto

### Contexto Multiempresa (`TenantContext`)
Toda operación autenticada requiere:
- `tenantId`: Identificador UUID/nominal del cliente.
- `slug`: Identificador legible único del tenant (ej. `sumak`).
- `limits`: Límites operativos de concurrencia, mensajes y presupuesto diario de IA.
- `timezone`: Zona horaria IANA del tenant (ej. `America/Guayaquil` o `UTC`).

### Sobre de Evento de Dominio (`DomainEventEnvelope`)
- `eventId`: UUID único del evento.
- `tenantId`: Tenant propietario del evento.
- `eventType`: Nombre del evento en formato `<dominio>.<entidad>.<accion>` (ej. `whatsapp.message.received`).
- `correlationId`: Identificador de trazabilidad extremo a extremo.
- `idempotencyKey`: Clave determinista para prevenir ejecuciones duplicadas.
- `occurredAt`: Fecha ISO-8601 en UTC.
- `payload`: Carga específica del evento.

---

## 3. Estándar de Errores de Dominio (`@rsd-sync/shared`)

Los errores del sistema extienden `RsdError` con código estable, estado HTTP sugerido y metadatos seguros (sin secretos):

| Clase de Error | Código | Uso |
| --- | --- | --- |
| `ValidationError` | `VALIDATION_ERROR` | Fallo de esquema Zod o regla de entrada |
| `TenantIsolationError` | `TENANT_ISOLATION_VIOLATION` | Discrepancia de `tenantId` entre actor y recurso |
| `UnauthorizedOperationError` | `UNAUTHORIZED_OPERATION` | Rol o permiso insuficiente, o herramienta IA no autorizada |
| `ExternalValidationRequiredError` | `EXTERNAL_VALIDATION_REQUIRED` | Intento de confirmar pago/venta/inventario/matrícula sin validación externa |

---

## 4. Idempotencia y Webhooks

- Los endpoints de webhooks responden rápidamente tras validar la firma HMAC y persistir/encolar el evento con `idempotencyKey`.
- Cualquier reintento con la misma `idempotencyKey` dentro del mismo `tenantId` debe devolver la referencia de la ejecución existente sin duplicar efectos secundarios.

---

## 5. Endpoints Operativos Implementados (Fase 1)

| Endpoint | Protección | Descripción |
| --- | --- | --- |
| `GET /health` | Pública | Sonda básica del proceso Fastify |
| `GET /health/live` | Pública | Liveness probe del proceso HTTP |
| `GET /health/ready` | Pública | Readiness probe de Redis y base de datos (`200` / `503`) |
| `GET /api/v1/status` | `Bearer` JWT o `x-admin-api-key` | Diagnóstico consolidado (API, Worker, Redis, DB, Supabase) sin secretos |
| `POST /api/v1/jobs/test` | `Bearer` JWT o `x-admin-api-key` | Encola trabajo de prueba en BullMQ (`rsd.events`) |
| `GET /api/v1/jobs` | `Bearer` JWT o `x-admin-api-key` | Lista trabajos recientes de prueba en BullMQ |
| `GET /api/v1/jobs/:jobId` | `Bearer` JWT o `x-admin-api-key` | Consulta estado, intentos, resultado o error de un trabajo |
