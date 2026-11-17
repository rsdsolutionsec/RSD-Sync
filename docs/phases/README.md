# Control de Fases — RSD Sync

El plan completo de 11 fases (Fase 0 a Fase 10) se mantiene en [ROADMAP.md](../../ROADMAP.md).

## Criterios Obligatorios de Cierre de Fase

Ninguna fase puede declararse cerrada sin cumplir simultáneamente:

1. **Código compilado y tipado**: `pnpm build` y `pnpm typecheck` finalizan con código `0`.
2. **Pruebas automatizadas verdes**: `pnpm test` ejecuta todas las suites unitarias, de contratos, de integración y de seguridad aplicables a la fase.
3. **Verificación de arquitectura**: `pnpm verify:foundation` confirma integridad documental, ausencia de secretos rastreados y aislamiento entre núcleo y adaptadores de clientes.
4. **Documentación sincronizada**: `CHANGELOG.md`, `ROADMAP.md` y los documentos específicos de `docs/` reflejan exactamente lo implementado (sin documentar capacidades inexistentes como activas).
5. **Control de cambios en Git**: Commits atómicos convencionales verificados y sincronizados con el repositorio remoto configurado.
