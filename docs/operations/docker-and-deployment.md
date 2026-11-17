# Operación Docker Local y Preparación para Despliegue en VPS

---

## 1. Servicios en Desarrollo Local (`docker-compose.yml`)

La arquitectura local utiliza contenedores reproducibles vinculados únicamente a `127.0.0.1`:

| Servicio | Imagen | Puerto Local (`127.0.0.1`) | Propósito |
| --- | --- | --- | --- |
| `redis` | `redis:7.4-alpine` | `6379` | Colas BullMQ, locks y cache operacional |
| `postgres` | `pgvector/pgvector:pg17` | `54322` | Persistencia multi-tenant RLS y vectores RAG |
| `api` *(perfil `app`)* | `Dockerfile.api` | `4000` | Servidor HTTP Fastify (Fase 1+) |
| `worker` *(perfil `app`)* | `Dockerfile.worker` | — | Procesador BullMQ independiente (Fase 1+) |
| `admin` *(perfil `app`)* | `Dockerfile.admin` | `3000` | Panel administrativo Next.js (Fase 7+) |

### Volúmenes Persistentes
- `rsd_sync_redis_data`: Persistencia AOF de Redis.
- `rsd_sync_pg_data`: Datos de PostgreSQL local de desarrollo.

---

## 2. Portabilidad Windows 11 -> Linux VPS

- Todos los Dockerfiles en `infrastructure/docker/` usan imágenes Linux estándar (`node:22-alpine`) y rutas POSIX.
- No existen rutas absolutas de Windows ni dependencias de servicios exclusivos de Windows en el código fuente.
- Para el futuro despliegue en VPS (Fase 9):
  1. Se inyectarán secretos reales mediante variables de entorno del host/orquestador (sin archivos `.env` en Git).
  2. Se habilitará un reverse proxy con HTTPS/TLS automático (ver `infrastructure/proxy/README.md`).
  3. Redis y PostgreSQL permanecerán en la red interna privada sin exposición de puertos a Internet.
  4. Se ejecutarán backups automáticos cifrados de PostgreSQL antes de cada migración.
