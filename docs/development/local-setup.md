# Configuración del Entorno Local (Windows 11 / Docker)

Esta guía documenta la instalación y verificación local de **RSD Sync** durante la Fase 0 y fases iniciales.

---

## 1. Requisitos Previos

- **Node.js LTS**: `>= 22.0.0` (probado en Windows 11 con Node.js `v24.12.0`)
- **pnpm**: `10.x`
- **Git**: `2.40+`
- **Docker Desktop**: con Docker Compose v2 activo

---

## 2. Preparación del Repositorio

```powershell
# 1. Instalar dependencias del monorepo
pnpm install

# 2. Copiar plantilla de variables de entorno
Copy-Item .env.example .env
```

> **Advertencia**: No agregues credenciales productivas de **SUMAK** en `.env` durante desarrollo local ni pruebas automatizadas.

---

## 3. Infraestructura Local con Docker Compose

`docker-compose.yml` define dos servicios base vinculados exclusivamente a `127.0.0.1`:
- **Redis (`rsd-sync-redis`)**: `127.0.0.1:6379` (con persistencia AOF y política `noeviction` recomendada para BullMQ).
- **PostgreSQL + pgvector (`rsd-sync-postgres`)**: `127.0.0.1:54332` (puerto dedicado para evitar colisión con Supabase local en `54322`; ejecuta automáticamente `packages/database/migrations/*.sql` al inicializar el volumen).

Comandos disponibles:

```powershell
# Validar sintaxis y configuración de servicios
pnpm docker:config

# Iniciar Redis y PostgreSQL locales en segundo plano
pnpm docker:up

# Verificar estado de contenedores
docker compose ps

# Detener contenedores manteniendo volúmenes persistentes
pnpm docker:down
```

---

## 4. Comandos de Validación, Base de Datos y Procesos Locales

```powershell
# Verifica estructura obligatoria, ausencia de .env rastreados y reglas del repositorio
pnpm verify:foundation

# Compila todos los paquetes y aplicaciones TypeScript (incluye Next.js admin)
pnpm build

# Verifica tipos en todo el monorepo
pnpm typecheck

# Aplica migraciones SQL pendientes al target configurado (PostgreSQL local o Supabase)
pnpm db:migrate

# Ejecuta todas las pruebas unitarias, de contratos y de integración real
pnpm test
```

### Ejecución de Procesos Independientes (Fase 1)

En terminales separadas (con `.env` configurado y `pnpm docker:up` activo):

```powershell
# Terminal 1: API Fastify (http://127.0.0.1:4000)
pnpm dev:api

# Terminal 2: Worker BullMQ (conectado a Redis 127.0.0.1:6379)
pnpm dev:worker

# Terminal 3: Panel administrativo Next.js (http://127.0.0.1:3000)
pnpm dev:admin
```

Para consultar logs de contenedores Docker locales:
```powershell
docker compose logs -f redis postgres
```

---

## 5. Depuración Común en Windows 11

- **Error `dockerDesktopLinuxEngine` no encontrado**: Significa que Docker Desktop no ha sido iniciado todavía. Abre Docker Desktop y espera a que el motor Linux esté en estado *Running* antes de ejecutar `pnpm docker:up`.
- **Diferencias de fin de línea (`CRLF` vs `LF`)**: El código y scripts están diseñados para funcionar indistintamente en Windows 11 y Linux/Docker sin usar rutas absolutas dependientes de Windows.
