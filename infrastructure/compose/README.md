# Docker Compose Profiles & Overrides

El archivo principal `docker-compose.yml` en la raíz del repositorio levanta por defecto únicamente los servicios base locales vinculados a `127.0.0.1`:
- `redis` (`redis:7.4-alpine` en `127.0.0.1:6379`)
- `postgres` (`pgvector/pgvector:pg17` en `127.0.0.1:54322`)

Las aplicaciones (`api`, `worker`, `admin`) están agrupadas bajo el perfil `app` para ejecutarse en contenedor cuando las fases correspondientes implementen sus runtimes:
```bash
docker compose --profile app up --build
```
En fases posteriores (Fase 9), aquí se ubicarán overrides dedicados para staging y producción VPS.
