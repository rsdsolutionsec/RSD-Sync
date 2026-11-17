# CHANGELOG.md

Todos los cambios relevantes de **RSD Sync** se registran cronológicamente en este archivo siguiendo una estructura inspirada en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [0.1.0-phase0] — 2026-11-17

### Agregado (Fase 0 — Arquitectura y preparación)
- Inicialización del monorepo `pnpm` con TypeScript estricto (`NodeNext`, Project References) y Vitest.
- Configuración local reproducible con Docker Compose (`redis:7.4-alpine` y `pgvector/pgvector:pg17` vinculados a `127.0.0.1`) y `.env.example`.
- Documentación maestra completa: `AGENTS.md`, `README.md`, `ROADMAP.md` (Fases 0–10), `ARCHITECTURE.md`, `DECISIONS.md` (ADRs 001–006), `CONTRIBUTING.md`, `SECURITY.md` y guías en `docs/`.
- Paquetes base del monolito modular:
  - `@rsd-sync/shared`
  - `@rsd-sync/contracts`
  - `@rsd-sync/configuration`
  - `@rsd-sync/observability`
  - `@rsd-sync/security` (aislamiento por tenant, cifrado AES-256-GCM, firmas HMAC, RBAC)
  - `@rsd-sync/queue`
  - `@rsd-sync/database` (contratos multi-tenant y migración SQL inicial `0001_phase0_foundation.sql` con RLS)
  - `@rsd-sync/automation-core`
  - `@rsd-sync/ai-engine`
  - `@rsd-sync/crm-core`
  - `@rsd-sync/integrations` (`whatsapp`, `sumak`, `generic-api`, `email`)
- Puntos de entrada base para `apps/api`, `apps/worker` y `apps/admin`, junto con Dockerfiles multi-etapa en `infrastructure/docker/`.
- Script de verificación `scripts/verify-foundation.mjs`, flujo CI en `.github/workflows/ci.yml` y suites iniciales de pruebas unitarias, contratos y fronteras arquitectónicas.
