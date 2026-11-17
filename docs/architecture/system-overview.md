# Visión General del Sistema — RSD Sync

## 1. Diagrama de Componentes

```mermaid
flowchart TB
    subgraph External["Canales y Sistemas Externos"]
        WA["WhatsApp Cloud API"]
        SUMAK["Plataforma SUMAK (APIs / RPC Autorizadas)"]
        EXT["Otras APIs / Email"]
    end

    subgraph Runtime["Aplicaciones Ejecutables (apps/)"]
        API["apps/api (Fastify HTTP & Webhooks)"]
        WORKER["apps/worker (BullMQ Workers & Scheduler)"]
        ADMIN["apps/admin (Next.js Panel Multi-Tenant)"]
    end

    subgraph Core["Paquetes de Dominio Desacoplados (packages/)"]
        AUTO["automation-core"]
        AI["ai-engine"]
        CRM["crm-core"]
        SEC["security"]
        DB["database"]
        QUEUE["queue"]
        INTEG["integrations (Adapters)"]
    end

    subgraph Infra["Infraestructura Local / VPS"]
        REDIS["Redis 7.4"]
        PG["PostgreSQL 17 + pgvector (RLS)"]
    end

    WA <--> API
    ADMIN <--> API
    API --> SEC
    API --> QUEUE
    QUEUE <--> REDIS
    WORKER <--> REDIS
    WORKER --> AUTO
    WORKER --> AI
    WORKER --> CRM
    WORKER --> INTEG
    INTEG <--> SUMAK
    INTEG <--> EXT
    AUTO --> DB
    CRM --> DB
    AI --> DB
    DB <--> PG
```

---

## 2. Flujo de Atención Inteligente e Intervención Humana

```mermaid
sequenceDiagram
    participant Cliente as Cliente Final (WhatsApp)
    participant API as apps/api
    participant Cola as Redis / BullMQ
    participant Worker as apps/worker
    participant CRM as crm-core
    participant AI as ai-engine
    participant Sumak as Adaptador SUMAK
    participant Sec as Secretaría (apps/admin)

    Cliente->>API: Webhook mensaje entrante
    API->>API: Verifica firma HMAC-SHA256 y valida esquema Zod
    API->>Cola: Encola evento normalizado (idempotencia)
    API-->>Cliente: HTTP 200 OK (asíncrono)
    Cola->>Worker: Consume trabajo con TenantContext
    Worker->>CRM: Consulta estado de conversación
    alt Conversación en modo HUMAN (aiPaused = true)
        CRM-->>Worker: IA pausada, solo registra mensaje
        Worker-->>Sec: Notifica bandeja de entrada
    else Conversación en modo AI
        Worker->>AI: Ejecuta agente con RAG del tenant
        AI->>Sumak: Tool autorizada de solo lectura (ej. cursos/stock)
        Sumak-->>AI: Datos validados (sin confirmar pago/venta)
        AI-->>Worker: Respuesta redactada o solicitud de derivación
        Worker->>CRM: Persiste respuesta (o deriva a HUMAN)
        Worker-->>Cliente: Envía respuesta vía adaptador WhatsApp
    end
```

---

## 3. Regla de Dependencias

Todas las dependencias entre paquetes fluyen hacia abajo hacia `@rsd-sync/contracts` y `@rsd-sync/shared`. Los paquetes núcleo (`automation-core`, `ai-engine`, `crm-core`, `security`, `database`, `queue`) nunca dependen de `@rsd-sync/integrations` ni de lógica de un cliente concreto.
