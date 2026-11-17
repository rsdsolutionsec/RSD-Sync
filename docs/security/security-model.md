# Modelo de Seguridad — RSD Sync

Este documento detalla los controles implementados en `@rsd-sync/security` y `@rsd-sync/observability` desde la Fase 0, así como las políticas operativas obligatorias para fases posteriores.

---

## 1. Controles Criptográficos (`@rsd-sync/security`)

### Cifrado de Secretos de Tenant (`AES-256-GCM`)
- Toda credencial de integración externa perteneciente a un cliente (ej. `WHATSAPP_ACCESS_TOKEN`, credenciales del adaptador SUMAK, claves API genéricas) se cifra antes de persistirse.
- Algoritmo: **AES-256-GCM** con IV aleatorio de 12 bytes por operación y etiqueta de autenticación (authTag) de 16 bytes.
- La llave maestra (`ENCRYPTION_MASTER_KEY`) se deriva a 32 bytes mediante SHA-256 o clave hexadecimal/base64 validada, y nunca se almacena junto al texto cifrado.

### Verificación de Firmas de Webhooks (`HMAC-SHA256`)
- Todo webhook externo debe validarse mediante `verifyHmacSignature` usando `crypto.timingSafeEqual` para prevenir ataques de temporización (*timing attacks*).
- Soporta prefijos estándar como `sha256=<digest>` (utilizado por Meta / WhatsApp Cloud API).

---

## 2. Aislamiento Multi-Tenant y RBAC

- **Guardia de Dominio**: `assertTenantIsolation(contextTenantId, resourceTenantId)` lanza `TenantIsolationError` ante cualquier discrepancia.
- **Roles definidos en la plataforma**:
  - `SUPER_ADMIN`: Administración global de plataforma RSD Solutions (sujeto a auditoría).
  - `TENANT_ADMIN`: Administración completa de su empresa cliente.
  - `OPERATOR`: Gestión de conversaciones, leads, aprobaciones y conocimiento de su tenant.
  - `SECRETARY`: Atención humana en conversaciones, derivaciones y validación comercial de su tenant.
  - `AI_AGENT`: Identidad restringida de ejecución automática con permisos estrictamente limitados y sin acceso directo a secretos ni confirmaciones financieras.

---

## 3. Redacción de Logs (`@rsd-sync/observability`)

- El sanitizador automático reemplaza recursivamente por `[REDACTED]` los valores de cualquier clave sensible (`password`, `token`, `secret`, `apiKey`, `authorization`, `cookie`, `accessToken`, `masterKey`, `privateKey`).

---

## 4. Amenazas Mitigadas Desde el Diseño

| Amenaza | Mitigación Arquitectónica |
| --- | --- |
| Fuga de datos entre empresas | `TenantContext` obligatorio + `assertTenantIsolation` + PostgreSQL RLS |
| Exposición de credenciales en repositorio | `.gitignore` + verificación CI/script de `.env` + `.env.example` limpio |
| Suplantación de webhooks WhatsApp | Verificación HMAC-SHA256 con `timingSafeEqual` |
| IA confirmando pagos o alterando stock | Política `SUMAK_VALIDATION_POLICY` + `AiToolGuard` en backend |
| Exposición de servicios internos locales | Puertos Docker vinculados exclusivamente a `127.0.0.1` |
