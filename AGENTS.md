# AGENTS.md — Reglas Permanentes de Ingeniería para RSD Sync

Este documento define las normas obligatorias que todo agente o ingeniero debe respetar al trabajar en el repositorio **RSD Sync**.

## 1. Identidad del Producto vs Primer Cliente
- **RSD Sync** es la plataforma tecnológica propia de **RSD Solutions** para automatización empresarial, mensajería omnicanal, CRM operativo y orquestación de agentes de IA.
- **SUMAK** es el **primer cliente** integrado sobre RSD Sync, **no el núcleo del sistema**.
- Ortografía obligatoria: el nombre del cliente es siempre **SUMAK** (nunca SUMAC). Cualquier referencia en código, contratos, variables de entorno, migraciones o documentación debe usar `SUMAK` / `sumak`.

## 2. Principios Arquitectónicos Obligatorios
1. **Monolito modular con workers independientes**: `apps/api`, `apps/worker` y `apps/admin` consumen paquetes internos desacoplados (`packages/*`). Prohibido fragmentar en microservicios innecesarios o adoptar n8n como núcleo.
2. **Separación estricta de dominio vs adaptadores**:
   - `packages/automation-core`, `packages/ai-engine`, `packages/crm-core`, `packages/security`, `packages/database` y `packages/queue` **jamás deben importar ni contener lógica específica de SUMAK**.
   - Toda integración externa con SUMAK vive aislada dentro de `packages/integrations/src/sumak`.
3. **Multi-tenant por diseño**: Toda entidad de negocio pertenece a un `tenantId` validado en backend y reforzado con Row Level Security (RLS) en PostgreSQL. Prohibido confiar únicamente en el frontend o usar una credencial administrativa global desde el navegador.
4. **Reglas inviolables de IA y negocio**:
   - La IA nunca se conecta directamente a tablas de producción de un cliente.
   - Toda herramienta ejecutable por la IA debe estar registrada, tipada con Zod, autorizada para el tenant y validada en backend.
   - **La IA no puede confirmar pagos, ventas, descuentos de inventario ni matrículas completadas sin validación explícita del sistema SUMAK**.
   - Cuando un humano o secretaria interviene en una conversación, la IA debe pausarse automáticamente (`mode = HUMAN`, `aiPaused = true`).
5. **Sincronización código-documentación**: No documentar funcionalidades futuras como si ya estuvieran implementadas. Distinguir explícitamente entre contratos/estructura de Fase 0 y capacidades de fases posteriores.

## 3. Reglas de Seguridad y Entorno
- Prohibido subir archivos `.env`, llaves privadas (`*.pem`, `*.key`), tokens o credenciales reales al repositorio.
- Toda credencial de integración por tenant debe almacenarse cifrada (AES-256-GCM) y nunca imprimirse en logs.
- Prohibido usar el proyecto Supabase de producción de SUMAK para desarrollo local o pruebas automatizadas.
- Los puertos locales de Docker Compose deben permanecer vinculados exclusivamente a `127.0.0.1`.
- No introducir dependencias de rutas o configuraciones exclusivas de Windows en código productivo o contenedores.

## 4. Flujo Git y Verificación Obligatoria
1. Ejecutar `git status` antes de realizar cambios.
2. Prohibido usar comandos destructivos (`git reset --hard`, force push, sobrescritura de historial).
3. Trabajar por tareas incrementales; cada unidad funcional completada debe tener su propio commit convencional (`chore:`, `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `security:`).
4. **No realizar commits sin haber ejecutado y aprobado las pruebas y verificaciones**:
   - `pnpm verify:foundation`
   - `pnpm build`
   - `pnpm typecheck`
   - `pnpm test`
5. Solicitar autorización explícita antes de: modificar producción de SUMAK, ejecutar migraciones en producción, alterar autenticación o permisos de usuarios reales, contratar servicios pagos o cambiar sustancialmente la arquitectura.
