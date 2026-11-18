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

# Carga el tenant inicial SUMAK, conexión WhatsApp local, agente Gemini y base de conocimiento auditada
pnpm seed:sumak

# Ejecuta todas las pruebas unitarias, de contratos y de integración real
pnpm test
```

### Ejecución del Bot WhatsApp Local + Simulador (Fase 1.4+)

1. Asegúrate de tener `AI_DEFAULT_PROVIDER=gemini`, `WHATSAPP_DELIVERY_MODE=local_http` y opcionalmente tu `GOOGLE_GENAI_API_KEY` en `.env`.
2. Con Redis y PostgreSQL locales activos (`pnpm docker:up`), aplica migraciones (`pnpm db:migrate`) y ejecuta `pnpm seed:sumak`.
3. Inicia `pnpm dev:api`, `pnpm dev:worker` y `pnpm dev:admin` en terminales separadas.
4. Ingresa a `http://127.0.0.1:3000/conversations` para probar el simulador webhook firmado con HMAC-SHA256, el hilo CRM, la pausa automática (`HUMAN`) y el registro de aprobaciones `PENDING_VALIDATION`.

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
