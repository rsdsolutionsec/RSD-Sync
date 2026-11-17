# Despliegue de `apps/admin` en Vercel (Monorepo pnpm)

Esta guía documenta cómo desplegar el panel administrativo de **RSD Sync** (`apps/admin`) en **Vercel** desde el monorepo `pnpm`.

---

## 1. Arquitectura de Despliegue Separada

Vercel ejecuta **únicamente** la aplicación Next.js (`apps/admin`). Los servicios backend permanecen desacoplados:

- **Frontend / BFF (`apps/admin`)**: Vercel (Next.js App Router).
- **API HTTP (`apps/api`)**: Servidor Node.js/Fastify independiente (con acceso a Redis y PostgreSQL/Supabase).
- **Worker (`apps/worker`)**: Proceso Node.js/BullMQ independiente.
- **Redis**: Servicio gestionado o contenedor privado (nunca en Vercel).
- **Base de datos y Auth**: Proyecto **Supabase** propio de **RSD Sync** (nunca el proyecto Supabase de SUMAK).

---

## 2. Configuración del Proyecto en Vercel

1. Importar el repositorio `rsdsolutionsec/RSD-Sync` en Vercel.
2. Configurar **Root Directory**: `apps/admin`.
3. **Framework Preset**: `Next.js` (detectado por `apps/admin/vercel.json`).
4. **Install Command**: `pnpm install --frozen-lockfile` *(ejecutado desde la raíz del monorepo por Vercel automáticamente cuando `pnpm-workspace.yaml` está presente)*.
5. **Build Command**: `pnpm --filter @rsd-sync/admin build` (o `npm run build` dentro de `apps/admin`).
6. `apps/admin/next.config.ts` declara `transpilePackages` para `@rsd-sync/configuration`, `@rsd-sync/contracts` y `@rsd-sync/shared`.

---

## 3. Variables de Entorno Requeridas en Vercel (Production y Preview)

| Variable | Alcance | Obligatoria en Producción | Descripción |
| --- | --- | --- | --- |
| `NODE_ENV` | Server | Sí (`production`) | Activa validaciones estrictas de producción |
| `API_URL` | Server Only | Sí | URL HTTPS pública de `apps/api` desplegada (nunca `127.0.0.1` ni Docker local) |
| `ADMIN_API_KEY` | Server Only | Recomendada | Clave compartida entre BFF de `apps/admin` y `apps/api` |
| `ADMIN_EMAILS` | Server Only | Sí | Lista separada por comas de correos administrativos autorizados |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Sí | URL pública del proyecto Supabase de **RSD Sync** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Sí | Clave pública `anon` del proyecto Supabase de **RSD Sync** |
| `JWT_SECRET` | Server Only | Sí | Secreto no por defecto (`>= 32` caracteres) |
| `ENCRYPTION_MASTER_KEY` | Server Only | Sí | Llave maestra no por defecto (`>= 32` caracteres) |

> **Reglas inviolables**:
> - **Nunca** configures `SUPABASE_SERVICE_ROLE_KEY` como variable `NEXT_PUBLIC_*`.
> - **Nunca** configures credenciales de **SUMAK** en el proyecto Vercel de RSD Sync.
> - Si `apps/api` todavía no está desplegada en la nube, `apps/admin` mostrará el estado real `API backend no disponible` sin romperse.
> - Si `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` o `ADMIN_EMAILS` faltan en producción, `/login` mantendrá el panel **bloqueado (fail-closed)**.
