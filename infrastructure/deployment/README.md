# Estrategia de Despliegue en VPS (Planificado para Fase 9)

El despliegue futuro en VPS mediante Docker Compose requerirá exclusivamente:
1. Variables de entorno y secretos reales fuera de Git.
2. Dominios DNS con TLS/HTTPS habilitado vía `infrastructure/proxy/`.
3. Volúmenes persistentes respaldados para PostgreSQL y Redis.
4. Ejecución de migraciones SQL versionadas antes de promover contenedores `api` y `worker`.
5. Health checks verificados (`/health/live`, `/health/ready`) antes de conmutar tráfico.
