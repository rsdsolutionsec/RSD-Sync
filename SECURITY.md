# SECURITY.md — Política de Seguridad y Protección de Datos

La seguridad en **RSD Sync** es un requisito de diseño desde la Fase 0, no un agregado posterior.

---

## 1. Gestión de Secretos y Variables de Entorno
- **Prohibido** subir archivos `.env`, llaves privadas, certificados o tokens reales a GitHub.
- Utilizar `.env.example` exclusivamente con nombres de variables y valores de ejemplo no sensibles.
- Toda credencial específica de un cliente (tokens de WhatsApp Cloud API, claves API, credenciales del adaptador SUMAK) debe cifrarse antes de guardarse en base de datos usando **AES-256-GCM** (`@rsd-sync/security`).
- Los logs estructurados (`@rsd-sync/observability`) deben redactar automáticamente campos sensibles (`password`, `token`, `secret`, `apiKey`, `authorization`, `cookie`).

---

## 2. Aislamiento Multiempresa (Multi-Tenancy)
- Ninguna operación de lectura o escritura puede ejecutarse sin un `TenantContext` válido.
- Las guardias de dominio (`assertTenantIsolation`) validan que el `tenantId` del recurso coincida con el del actor autorizado.
- En PostgreSQL, toda tabla con datos de clientes implementa políticas **Row Level Security (RLS)** apoyadas en `app_current_tenant_id()`.
- Jamás se debe confiar en parámetros enviados por el navegador sin revalidación en backend ni exponer una credencial administrativa global en el frontend (`apps/admin`).

---

## 3. Seguridad de Webhooks, Entradas y Escrituras
- Todo webhook entrante (ej. WhatsApp Cloud API) debe verificar su firma criptográfica (**HMAC-SHA256** con comparación en tiempo constante `crypto.timingSafeEqual`) antes de procesarse.
- Toda entrada externa se valida estrictamente con esquemas **Zod**.
- Toda operación crítica o mensaje entrante aplica **idempotencia** para evitar duplicaciones ante reintentos.
- Las consultas SQL deben usar siempre parámetros preparados; prohibida la concatenación dinámica de SQL con entradas de usuario.

---

## 4. Gobernanza de Inteligencia Artificial y Protección de SUMAK
- La IA **no** tiene acceso directo ni libre a bases de datos de producción ni a secretos de clientes.
- Cada herramienta invocable por el agente debe estar declarada en el registro de `@rsd-sync/ai-engine`, validada por esquema y autorizada explícitamente para el tenant.
- **Regla de negocio crítica para SUMAK**: El motor de IA y el núcleo de automatización tienen **prohibido** confirmar pagos, ventas, descuentos de inventario o matrículas completadas si el sistema SUMAK no ha validado explícitamente la operación correspondiente.
- Prohibido utilizar el proyecto Supabase de producción de SUMAK como base de pruebas o desarrollo local.

---

## 5. Infraestructura Local y Red
- Redis y PostgreSQL locales deben vincularse exclusivamente a `127.0.0.1` en `docker-compose.yml`.
- Redis no debe exponerse públicamente ni operar sin autenticación cuando se despliegue en entornos compartidos o VPS.
- Cualquier vulnerabilidad o exposición accidental de credenciales debe notificarse de inmediato al equipo de arquitectura de **RSD Solutions** para rotación inmediata de llaves.
