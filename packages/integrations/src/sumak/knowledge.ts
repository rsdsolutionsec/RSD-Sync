export interface SumakKnowledgeDocumentSeed {
  readonly title: string;
  readonly category: 'identity' | 'catalog' | 'mlm_packs' | 'academy' | 'payments' | 'policies';
  readonly source: string;
  readonly content: string;
}

export const SUMAK_TENANT_SEED_CONFIG = {
  slug: 'sumak',
  name: 'Sumak Vida Ecuador S.A. (SUMAK)',
  agentName: 'Asistente Comercial SUMAK',
  defaultChannelAccountId: 'local-sumak-phone-id',
} as const;

export const SUMAK_DEFAULT_SYSTEM_PROMPT = [
  'Eres el asistente virtual oficial de atención por WhatsApp de Sumak Vida Ecuador S.A. (SUMAK), operado sobre la plataforma RSD Sync.',
  'Responde siempre en español claro, cordial, profesional y conciso, pensado para mensajes de WhatsApp.',
  'Usa EXCLUSIVAMENTE la información verificada del contexto de conocimiento proporcionado para responder sobre productos, precios, packs, plan multinivel, Academia SUMAK, cuentas bancarias y canales oficiales.',
  'REGLAS INVIOLABLES DE NEGOCIO Y SEGURIDAD:',
  '1. Nunca inventes precios, promociones, stock en tiempo real ni beneficios médicos milagrosos.',
  '2. NUNCA confirmes pagos recibidos, ventas cerradas, descuentos de inventario ni matrículas completadas por tu cuenta. Toda operación transaccional requiere validación explícita de SUMAK o de una secretaria.',
  '3. Si el usuario reporta un comprobante de pago, solicita comprar un pedido/pack, quiere matricularse en un curso o pide hablar con una persona/secretaria, explica amablemente que la solicitud queda registrada como PENDIENTE DE VALIDACIÓN y que una secretaria de SUMAK continuará la atención.',
].join('\n');

export const SUMAK_AUDIT_KNOWLEDGE_DOCUMENTS: readonly SumakKnowledgeDocumentSeed[] = [
  {
    title: 'Identidad Institucional y Canales Oficiales SUMAK',
    category: 'identity',
    source: 'sumak-audit:src/data.ts',
    content: [
      'Empresa: Sumak Vida Ecuador S.A. (SUMAK).',
      'RUC: 1291781000001.',
      'Gerente General: Dr. Luis Paredes.',
      'Laboratorio: Sumak Jambi (Babahoyo, Los Ríos, Ecuador).',
      'Teléfono oficial: 0986046654.',
      'Correo oficial: sumak.vida1979@gmail.com.',
      'Sitio web: www.sumak.com.ec.',
    ].join('\n'),
  },
  {
    title: 'Catálogo de Productos y Precios SUMAK (16 referencias auditadas)',
    category: 'catalog',
    source: 'sumak-audit:src/data.ts',
    content: [
      'Listado oficial de productos SUMAK (PVP público; distribuidores activos tienen 50% de descuento en línea estándar salvo precio fijo indicado):',
      '- 00001: Té Extractos de la Vida — PVP $25.00',
      '- 00002: REGEN 24 — PVP $25.00',
      '- 00016: Colón Renova — PVP $25.00',
      '- 00003: Bebida Andina — PVP $20.00',
      '- 00004: Vive-Oxi-100 — PVP $25.00',
      '- 00005: Fibramak Plus — PVP $25.00',
      '- 00006: Moringa en Polvo — PVP $25.00',
      '- 00007: Colágeno Hidrolizado — PVP $27.50',
      '- 00008: Formula 1000 — PVP $60.00 (precio fijo distribuidor $20.00)',
      '- 00009: Fibramak Chupapanza — PVP $19.90',
      '- 00010: Original Moringa 90 cápsulas — PVP $22.50',
      '- 00011: Madre Silvestre 100 cápsulas — PVP $20.00',
      '- 00012: Shampoo Activa — PVP $20.00',
      '- 00013: Tomatodo Sumak — PVP $5.00 (merchandising)',
      '- 00014: Mochila Sumak — PVP $15.00 (merchandising)',
      '- 00015: Catálogo Sumak — PVP $10.00 (próximamente)',
      'Nota operativa: la disponibilidad de stock exacto requiere consulta/validación en el sistema operativo SUMAK.',
    ].join('\n'),
  },
  {
    title: 'Packs de Ingreso y Plan Multinivel (MLM) SUMAK',
    category: 'mlm_packs',
    source: 'sumak-audit:src/data.ts',
    content: [
      'Packs de afiliación / ingreso SUMAK:',
      '- Pack Básico: $125.00 (125 puntos, incluye 9 productos).',
      '- Pack Emprendedor: $225.00 (225 puntos, incluye 17 productos).',
      '- Pack Líder: $525.00 (525 puntos, incluye 41 productos).',
      'Reglas del plan de compensación:',
      '- Descuento estándar de distribuidor: 50%.',
      '- Activación mensual requerida: $100.00.',
      '- Bono por referido directo: 40%.',
      '- Estructura de 14 niveles MLM dividida en Tramo 1 (desde Socio hasta Gerente nivel 2) y Tramo 2 (desde Gerente hasta Fundador Internacional).',
    ].join('\n'),
  },
  {
    title: 'Academia SUMAK — Programa Especialización en Salud Renal',
    category: 'academy',
    source: 'sumak-audit:PROGRAMA_EDUCATIVO_SALUD_RENAL_SUMAK.md',
    content: [
      'Programa principal de Academia SUMAK: Especialización en Salud Renal y Terapia Botánica Andina (modalidad free_registered para registrados).',
      '- Curso 1: Bases Fisiológicas y Prevención Renal: El Enfoque Ancestral SUMAK — Duración: 180 minutos. Nota mínima de aprobación: 70%.',
      '- Curso 2: Fitoterapia Avanzada y Protocolos Renales con Chancapiedra y Plantas Andinas — Duración: 240 minutos. Nota mínima de aprobación: 75%. Prerrequisito: aprobar el Curso 1.',
      'La confirmación definitiva de matrícula o emisión de acceso administrativo requiere validación del sistema SUMAK.',
    ].join('\n'),
  },
  {
    title: 'Cuentas Bancarias Oficiales y Política de Pagos SUMAK',
    category: 'payments',
    source: 'sumak-audit:src/data.ts',
    content: [
      'Cuentas bancarias oficiales de Sumak Vida Ecuador S.A. para depósitos o transferencias:',
      '- Banco Pichincha: 2209693652',
      '- Produbanco: 20007560670',
      '- Banco Bolivariano: 2051078767',
      'Ventana de espera operativa para reporte de pago: 15 minutos.',
      'Importante: ningún pago se da por confirmado en WhatsApp hasta que el equipo de SUMAK o una secretaria valide el comprobante en la plataforma oficial.',
    ].join('\n'),
  },
  {
    title: 'Política de Escalamiento Humano y Validación Comercial',
    category: 'policies',
    source: 'sumak-audit:GUIA_OPERACIONES.md',
    content: [
      'Cuando un cliente desea concretar una compra, reportar una transferencia/comprobante, solicitar una matrícula formal o conversar con un asesor humano:',
      '- La solicitud queda registrada como PENDING_VALIDATION.',
      '- La conversación pasa a modo HUMAN (IA pausada) para que una secretaria revise y confirme en SUMAK.',
    ].join('\n'),
  },
] as const;
