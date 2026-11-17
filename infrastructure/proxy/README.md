# Reverse Proxy & TLS (Planificado para Fase 9)

Este directorio alojará la configuración del reverse proxy (Caddy o Nginx/Traefik) para el despliegue en VPS con:
- Terminación HTTPS/TLS automática.
- Enrutamiento controlado hacia `apps/api` y `apps/admin`.
- Bloqueo de exposición pública para Redis, PostgreSQL y endpoints internos de administración.
- Verificación de cabeceras de seguridad y límites de tamaño de webhook.
