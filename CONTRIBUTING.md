# CONTRIBUTING.md — Convenciones de Desarrollo para RSD Sync

## 1. Principios de Contribución
Todo cambio en **RSD Sync** debe preservar el diseño de **monolito modular multiempresa** de **RSD Solutions**:
- El dominio central (`automation-core`, `ai-engine`, `crm-core`, `security`, `database`, `queue`) debe permanecer libre de lógica específica de clientes particulares.
- Toda integración con **SUMAK** debe vivir exclusivamente en `packages/integrations/src/sumak` y mantener su ortografía correcta (`SUMAK`).

---

## 2. Flujo de Trabajo Git

1. Inspeccionar siempre `git status` antes de comenzar.
2. Repositorio remoto oficial: `https://github.com/rsdsolutionsec/RSD-Sync.git`. El agente realiza únicamente commits locales verificados; el `git push` es ejecutado manualmente por el propietario del repositorio.
3. No trabajar con código no probado ni agrupar múltiples fases en un solo commit.
4. Para funcionalidades extensas, crear ramas descriptivas desde `main`:
   - `feat/<modulo-o-fase>`
   - `fix/<descripcion-corta>`
   - `docs/<tema>`
   - `security/<control>`
5. Prohibido usar `git reset --hard`, `--force` o sobrescribir la rama principal.

### Formato de Commits (Conventional Commits)
- `chore:` — configuración, dependencias, tooling, infraestructura base
- `feat:` — nueva capacidad o módulo funcional
- `fix:` — corrección de error
- `refactor:` — reestructuración sin cambio de comportamiento externo
- `test:` — incorporación o mejora de pruebas
- `docs:` — documentación y ADRs
- `security:` — controles de acceso, cifrado, validación de firmas o políticas RLS

---

## 3. Estándares de Código TypeScript

- Usar ESM (`"type": "module"`) y extensiones `.js` en imports relativos requeridos por `NodeNext`.
- Mantener activadas las banderas estrictas (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- Validar toda entrada externa o variable de entorno con **Zod**.
- Usar tipos nominales (`TenantId`, `UserId`, `CorrelationId`, `ExecutionId`) en fronteras de dominio.
- Nunca imprimir secretos, encabezados `Authorization` ni llaves privadas en logs.

---

## 4. Checklist Antes de Hacer Commit

1. `pnpm verify:foundation`
2. `pnpm build`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm docker:config` (si hubo cambios en Docker/Compose)
6. Actualizar obligatoriamente `CONTEXT.md` (qué, por qué, cómo, funcionalidades e integraciones) y `AUDIT.md` (controles, hallazgos y resultados de pruebas) en cada iteración.
7. Actualizar `CHANGELOG.md` y la documentación afectada en `docs/` cuando corresponda.
