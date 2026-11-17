# Especificación de Integración: SUMAK

> **Regla de nomenclatura**: El nombre oficial del cliente es siempre **SUMAK** (nunca SUMAC).

---

## 1. Principios de Integración

**SUMAK** es el primer cliente empresarial conectado a **RSD Sync**, pero la plataforma RSD Sync pertenece arquitectónicamente a RSD Solutions. Por ello:

1. **Aislamiento total en adaptador**: Toda lógica específica de SUMAK reside únicamente en `packages/integrations/src/sumak`.
2. **Prohibición en núcleo**: `automation-core`, `ai-engine`, `crm-core`, `security`, `database` y `queue` jamás importan el adaptador SUMAK ni modelan reglas exclusivas de SUMAK.
3. **Sin acceso directo a tablas productivas por la IA**: Ningún modelo de IA se conecta directamente al proyecto Supabase de producción de SUMAK.
4. **Uso obligatorio de APIs / RPC autorizadas**: Las consultas y solicitudes pasan por endpoints o funciones RPC autorizadas, validadas con Zod y controladas por permisos.

---

## 2. Dominios de SUMAK a Auditar en Fase 4

Durante la **Fase 4 (Auditoría e integración de SUMAK)** se inspeccionará el repositorio existente de SUMAK **en modo solo lectura (sin modificarlo)** para documentar el contrato real de:

- Sistema multinivel
- Productos y precios
- Inventario y disponibilidad
- Academia y cursos
- Matrículas
- Pagos y estados de pago
- Usuarios y roles
- Funciones RPC y Edge Functions disponibles

---

## 3. Reglas Invariantes de Negocio y Seguridad

### Política de Validación Externa (`SUMAK_VALIDATION_POLICY`)
La IA de RSD Sync y el motor de automatizaciones tienen **estrictamente prohibido** confirmar como completadas cualquiera de las siguientes operaciones sin que SUMAK haya emitido una validación explícita:

1. **Pagos confirmados** (`confirmPayment`)
2. **Ventas cerradas** (`confirmSale`)
3. **Inventario descontado** (`confirmInventoryDeduction`)
4. **Matrículas completadas** (`confirmEnrollment`)

En su lugar, cuando un cliente solicite comprar, matricularse o reportar un pago por WhatsApp:
- El agente consulta información oficial en **solo lectura** (precios, disponibilidad, requisitos de cursos, estado actual).
- Registra una **solicitud comercial o solicitud de matrícula** en estado `PENDING_VALIDATION`.
- Deriva la conversación a una **secretaria** (`mode = HUMAN`, `aiPaused = true`) o espera la validación oficial desde SUMAK antes de confirmar.
