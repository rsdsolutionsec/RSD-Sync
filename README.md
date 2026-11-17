# RSD Sync

**RSD Sync** es la plataforma tecnológica modular y multiempresa de **RSD Solutions** para orquestación de automatizaciones, atención comercial inteligente, integración con sistemas empresariales y gestión operativa omnicanal.

El primer cliente real que se integrará sobre la plataforma es **SUMAK**, mediante un adaptador desacoplado que preserva la reutilización de RSD Sync para futuros clientes.

---

## Estado Actual del Proyecto

- **Fases completadas**: **Fase 0 — Arquitectura y preparación** y **Fase 1 — Infraestructura operativa, Supabase y primer panel web**
- **Estado de ejecución**: API HTTP real con **Fastify**, proceso worker independiente con **BullMQ** sobre **Redis**, persistencia y migraciones SQL en **PostgreSQL 17 (`pgvector`)** + conector preparado para el proyecto **Supabase** propio de RSD Sync, y panel web de diagnóstico en **Next.js (`apps/admin`)** listo para despliegue en **Vercel**. Las capacidades de dominio avanzadas (Automation Core persistente, RBAC completo, auditoría SUMAK, AI Engine runtime, WhatsApp y CRM UI completo) se implementarán entre las Fases 2 y 10 según [ROADMAP.md](./ROADMAP.md).

---

## Stack Tecnológico

| Capa | Tecnología |
| --- | --- |
| **Monorepo y Runtime** | Node.js LTS (>=22), TypeScript estricto (`NodeNext`), pnpm workspaces |
| **Backend & Contratos** | Fastify 5, Zod |
| **Colas & Scheduler** | Redis 7.4, BullMQ 6 |
| **Persistencia** | PostgreSQL 17 + `pgvector`, Supabase (`@supabase/supabase-js` / `@supabase/ssr`), migraciones SQL versionadas, RLS |
| **Panel Administrativo** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Lucide Icons (desplegable en Vercel) |
| **Inteligencia Artificial** | Capa agnóstica de proveedores con herramientas autorizadas y RAG (Fase 5+) |
| **Infraestructura & Pruebas** | Docker, Docker Compose, Vitest, GitHub Actions CI |

---

## Estructura del Repositorio

```text
.
├── apps/
│   ├── api/                 # Punto de entrada API Fastify (Fase 1+)
│   ├── worker/              # Procesadores de colas BullMQ y schedulers (Fase 1+)
│   └── admin/               # Panel operativo Next.js (Fase 7+)
├── packages/
│   ├── shared/              # Tipos nominales (TenantId, etc.), Result<T,E>, errores de dominio
│   ├── contracts/           # Esquemas Zod y contratos compartidos entre apps y módulos
│   ├── configuration/       # Validación centralizada de variables de entorno y redacción
│   ├── observability/       # Logger estructurado con sanitización de secretos y health types
│   ├── security/            # Aislamiento multi-tenant, cifrado AES-256-GCM, HMAC, RBAC
│   ├── queue/               # Nombres de colas, sobres de trabajos y políticas de reintento
│   ├── database/            # Contratos de repositorios con TenantId y migraciones SQL RLS
│   ├── automation-core/     # Eventos, máquina de estados de ejecución e idempotencia
│   ├── ai-engine/           # Interfaces de proveedores IA, guardias de tools, RAG y costos
│   ├── crm-core/            # Conversaciones, pausa/reanudación de IA, leads y aprobaciones
│   └── integrations/        # Adaptadores independientes: whatsapp, sumak, generic-api, email
├── infrastructure/          # Dockerfiles y documentación de despliegue/proxy/monitoreo
├── docs/                    # Documentación técnica por dominio
├── tests/                   # Pruebas unitarias, de contratos, integración arquitectónica y e2e
├── scripts/                 # Scripts de verificación del repositorio
├── docker-compose.yml       # Redis + PostgreSQL local vinculados a 127.0.0.1
└── .env.example             # Plantilla segura de variables de entorno
```

---

## Requisitos Locales (Windows 11 / Linux / macOS)

- **Node.js** `>= 22.0.0` (verificado con Node.js v24 LTS)
- **pnpm** `10.x`
- **Docker** y **Docker Compose v2+** (Docker Desktop en Windows 11)
- **Git**

---

## Instalación y Verificación Local

1. **Instalar dependencias del workspace**:
   ```bash
   pnpm install
   ```

2. **Configurar variables de entorno locales** (opcional para Fase 0; obligatorio antes de levantar Docker o apps):
   ```bash
   cp .env.example .env
   ```
   *(En PowerShell: `Copy-Item .env.example .env`)*

3. **Validar configuración de Docker Compose**:
   ```bash
   pnpm docker:config
   ```

4. **Levantar servicios locales base (Redis + PostgreSQL/pgvector)** cuando Docker Desktop esté activo:
   ```bash
   pnpm docker:up
   ```

5. **Ejecutar migraciones SQL y verificación integral**:
   ```bash
   pnpm build
   pnpm typecheck
   pnpm db:migrate
   pnpm verify:foundation
   pnpm test
   ```

6. **Iniciar servicios en local** (en terminales separadas):
   ```bash
   pnpm dev:api
   pnpm dev:worker
   pnpm dev:admin
   ```

---

## Documentación Clave

- [AGENTS.md](./AGENTS.md) — Reglas permanentes para agentes y desarrolladores (incluye obligación de mantener `CONTEXT.md` y `AUDIT.md` en cada iteración)
- [CONTEXT.md](./CONTEXT.md) — Contexto vivo por iteración (qué se hace, por qué se hace, cómo se hace) y catálogo de funcionalidades e integraciones
- [AUDIT.md](./AUDIT.md) — Registro maestro de auditoría técnica, seguridad multi-tenant, fronteras arquitectónicas y bitácora de verificaciones
- [ROADMAP.md](./ROADMAP.md) — Plan maestro detallado por fases (Fases 0 a 10)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Arquitectura del monolito modular, workers y multi-tenancy
- [DECISIONS.md](./DECISIONS.md) — Registro de decisiones arquitectónicas (ADRs)
- [SECURITY.md](./SECURITY.md) — Política de seguridad, secretos, webhooks y control de IA
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Convenciones de commits, ramas y pruebas
- [CHANGELOG.md](./CHANGELOG.md) — Registro cronológico de cambios
- [docs/integrations/sumak-integration.md](./docs/integrations/sumak-integration.md) — Contrato arquitectónico del adaptador SUMAK
