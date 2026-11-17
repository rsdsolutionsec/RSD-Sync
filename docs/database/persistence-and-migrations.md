# Persistencia, Evaluación de Base de Datos Local y Migraciones

## 1. Evaluación Técnica: PostgreSQL Local (`pgvector`) vs Supabase de Producción

Durante la Fase 0 se evaluó cómo aislar el desarrollo y las pruebas de **RSD Sync** respecto al entorno productivo de **SUMAK**:

- **Regla inviolable**: Jamás se utilizará el proyecto Supabase de producción de SUMAK como base de datos de desarrollo ni de pruebas de RSD Sync.
- **Solución adoptada (ADR-003)**: Utilizar **PostgreSQL 17 con extensión `pgvector`** (`pgvector/pgvector:pg17`) en Docker Compose local en `127.0.0.1:54332`, utilizando migraciones SQL versionadas compatibles con PostgreSQL estándar y Supabase.
- **Beneficios**:
  1. Soporte nativo de **Row Level Security (RLS)** y políticas multi-tenant idénticas a Supabase.
  2. Soporte nativo de **embeddings vectoriales (`vector`)** para la base de conocimiento RAG (Fase 5) sin introducir una segunda base de datos.
  3. Portabilidad directa hacia Supabase gestionado o PostgreSQL en VPS en futuras fases.
  4. Cero dependencias de servicios externos o cuotas en la nube durante el desarrollo local.

*(Nota: Si en fases posteriores se requiere probar características específicas de Supabase Auth/Storage en local, se podrá añadir el stack local de Supabase CLI sin alterar el contrato SQL de migraciones).*

---

## 2. Estrategia de Migraciones Versionadas

Las migraciones residen en `packages/database/migrations/` con prefijo numérico secuencial (`0001_phase0_foundation.sql`, `0002_...`).

### Convenciones Obligatorias de Migración
1. Toda tabla con datos de clientes debe incluir `tenant_id UUID NOT NULL REFERENCES tenants(id)`.
2. Toda tabla multi-tenant debe activar `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` y `FORCE ROW LEVEL SECURITY;`.
3. Las políticas RLS deben basarse en `app_current_tenant_id()`, obtenida mediante `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`.
4. Toda modificación de esquema debe ser idempotente o estrictamente versionada hacia adelante, sin editar migraciones ya aplicadas en entornos compartidos.

---

## 3. Esquema Inicial y Endurecimiento (`0001` y `0002`)

- **`0001_phase0_foundation.sql`**:
  - Extensiones `pgcrypto` y `vector`.
  - Función `app_current_tenant_id()`.
  - Tabla `tenants` y tabla `audit_logs` con políticas RLS activadas y forzadas (`FORCE ROW LEVEL SECURITY`).
- **`0002_phase1_supabase_hardening.sql`**:
  - Tabla de control de migraciones `rsd_schema_migrations` con RLS activado.
  - Política RLS completa (`FOR ALL` con `USING` y `WITH CHECK`) sobre `tenants`.
  - Revocación de permisos directos para `anon` en tablas internas cuando corre dentro de Supabase.
  - Rol no superusuario `rsd_sync_app` (`NOBYPASSRLS`) para validar aislamiento real mediante pruebas automatizadas.

---

## 4. Conexión Dual: PostgreSQL Local vs Supabase Cloud de RSD Sync

`PostgresDatabaseClient` (`packages/database/src/clients/postgres-client.ts`) y `SupabaseConnector` (`packages/database/src/clients/supabase-client.ts`) operan sobre una única fuente de verdad resuelta por `resolveEffectiveDatabaseConnection`:

1. **`DATABASE_TARGET=local`**: utiliza `DATABASE_URL` (`127.0.0.1:54332` en Docker local).
2. **`DATABASE_TARGET=supabase`**: exige `RSD_DATABASE_URL` (y `RSD_DATABASE_DIRECT_URL` para migraciones) con SSL automático hacia el proyecto Supabase propio de **RSD Sync**.
3. **`DATABASE_TARGET=auto`** *(por defecto)*: usa `RSD_DATABASE_URL` si está configurada; si no, usa PostgreSQL local de Docker sin bloquear el desarrollo.

> **Nota de seguridad**: `SUPABASE_SERVICE_ROLE_KEY` solo se instancia en backend (`SupabaseConnector`) y jamás se expone a `apps/admin` en el navegador.
