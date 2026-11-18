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

## 2. Auditoría Read-Only de SUMAK (Completada para Base de Conocimiento Local)

Durante la preparación del primer agente de atención por WhatsApp se auditó el repositorio local de SUMAK (`..\Sumak`) **en modo estrictamente de solo lectura**, sin modificar código ni conectar la base productiva de SUMAK.

### 2.1. Identidad Institucional y Contacto
- **Razón social**: Sumak Vida Ecuador S.A. (`SUMAK`)
- **RUC**: `1291781000001`
- **Gerencia / Laboratorio**: Gerente General Dr. Luis Paredes; Laboratorio **Sumak Jambi** (Babahoyo, Los Ríos, Ecuador)
- **Canales oficiales**: Teléfono `0986046654`, correo `sumak.vida1979@gmail.com`, sitio web `www.sumak.com.ec`

### 2.2. Catálogo de Productos y Precios Auditados
| Código | Producto | PVP | Notas de distribuidor |
| --- | --- | --- | --- |
| `00001` | Té Extractos de la Vida | \$25.00 | 50% descuento distribuidor |
| `00002` | REGEN 24 | \$25.00 | 50% descuento distribuidor |
| `00016` | Colón Renova | \$25.00 | 50% descuento distribuidor |
| `00003` | Bebida Andina | \$20.00 | 50% descuento distribuidor |
| `00004` | Vive-Oxi-100 | \$25.00 | 50% descuento distribuidor |
| `00005` | Fibramak Plus | \$25.00 | 50% descuento distribuidor |
| `00006` | Moringa en Polvo | \$25.00 | 50% descuento distribuidor |
| `00007` | Colágeno Hidrolizado | \$27.50 | 50% descuento distribuidor |
| `00008` | Formula 1000 | \$60.00 | Precio fijo distribuidor \$20.00 |
| `00009` | Fibramak Chupapanza | \$19.90 | 50% descuento distribuidor |
| `00010` | Original Moringa 90 caps | \$22.50 | 50% descuento distribuidor |
| `00011` | Madre Silvestre 100 caps | \$20.00 | 50% descuento distribuidor |
| `00012` | Shampoo Activa | \$20.00 | 50% descuento distribuidor |
| `00013` | Tomatodo Sumak | \$5.00 | Merchandising |
| `00014` | Mochila Sumak | \$15.00 | Merchandising |
| `00015` | Catálogo Sumak | \$10.00 | Próximamente |

### 2.3. Packs de Ingreso y Plan Multinivel (MLM)
- **Packs**:
  - `Pack Básico`: \$125.00 (125 pts, 9 productos)
  - `Pack Emprendedor`: \$225.00 (225 pts, 17 productos)
  - `Pack Líder`: \$525.00 (525 pts, 41 productos)
- **Reglas comerciales**:
  - Descuento base de distribuidor: 50% sobre PVP en productos estándar.
  - Activación mensual requerida: \$100.00.
  - Bono por referido directo: 40%.
  - Ventana de espera de pago registrada en flujo operativo: 15 minutos.
  - Estructura MLM de 14 niveles dividida en **Tramo 1** (`Socio` hasta `Gerente nivel 2`) y **Tramo 2** (`Gerente` hasta `Fundador Internacional`).

### 2.4. Pagos y Cuentas Bancarias Oficiales
- **Cuentas bancarias para depósitos / transferencias** (siempre sujetas a validación de comprobante por SUMAK / secretaría):
  - Banco Pichincha: `2209693652`
  - Produbanco: `20007560670`
  - Banco Bolivariano: `2051078767`
- **Tablas y funciones auditadas en SUMAK**: `productos`, `pedidos`, `pedido_items`, `pagos`, `afiliaciones`, `comisiones`, `volumenes_binarios`, `red_binaria`, `rangos_historia`, `profiles`, `academy_*` y 20 Edge Functions (`payphone-*`, `paypal-*`, `approve-afiliacion`, `sign-voucher-url`, `academy-*`).

### 2.5. Academia SUMAK
- **Programa principal**: *Especialización en Salud Renal y Terapia Botánica Andina* (modalidad `free_registered`).
- **Cursos**:
  - **Curso 1**: *Bases Fisiológicas y Prevención Renal: El Enfoque Ancestral SUMAK* (duración 180 min, aprobación 70%).
  - **Curso 2**: *Fitoterapia Avanzada y Protocolos Renales con Chancapiedra y Plantas Andinas* (duración 240 min, aprobación 75%, prerrequisito: Curso 1).
- **Roles de plataforma SUMAK**: `distribuidor`, `admin`, `operaciones`, `academy_admin`, `instructor`.

---

## 3. Reglas Invariantes de Negocio y Seguridad

### Política de Validación Externa (`SUMAK_VALIDATION_POLICY`)
La IA de RSD Sync y el motor de automatizaciones tienen **estrictamente prohibido** confirmar como completadas cualquiera de las siguientes operaciones sin que SUMAK haya emitido una validación explícita:

1. **Pagos confirmados** (`confirmPayment`)
2. **Ventas cerradas** (`confirmSale`)
3. **Inventario descontado** (`confirmInventoryDeduction`)
4. **Matrículas completadas** (`confirmEnrollment`)

En su lugar, cuando un cliente solicite comprar, matricularse o reportar un pago por WhatsApp:
- El agente consulta información oficial de solo lectura (precios, descripción de productos, packs, requisitos de cursos, cuentas oficiales).
- Registra una **solicitud comercial o solicitud de matrícula** en estado `PENDING_VALIDATION` en `commercial_approvals` dentro de RSD Sync.
- Deriva la conversación a una **secretaria** (`mode = HUMAN`, `aiPaused = true`) o espera la validación oficial desde SUMAK antes de confirmar.
