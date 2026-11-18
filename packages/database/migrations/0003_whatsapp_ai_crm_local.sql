-- ==============================================================================
-- RSD Sync — Migration 0003 — Multi-Tenant WhatsApp, AI Knowledge & CRM State
-- ==============================================================================

CREATE TABLE IF NOT EXISTS channel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('WHATSAPP', 'WEB', 'EMAIL', 'API')),
  external_account_id text NOT NULL,
  display_name text NOT NULL,
  encrypted_credentials jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, external_account_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_connections_tenant
  ON channel_connections (tenant_id, channel);

CREATE TABLE IF NOT EXISTS ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini', 'custom')),
  model text NOT NULL,
  system_prompt text NOT NULL,
  daily_cost_limit_usd numeric(10, 4) NOT NULL DEFAULT 10.0000,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, title)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_tenant
  ON knowledge_documents (tenant_id, is_active);

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone_e164 text NOT NULL,
  primary_channel text NOT NULL DEFAULT 'WHATSAPP',
  external_reference_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone_e164)
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('WHATSAPP', 'WEB', 'EMAIL', 'API')),
  mode text NOT NULL DEFAULT 'AI' CHECK (mode IN ('AI', 'HUMAN', 'COPILOT')),
  ai_paused boolean NOT NULL DEFAULT false,
  assigned_user_id text,
  pause_reason text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, contact_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_last_msg
  ON conversations (tenant_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('WHATSAPP', 'WEB', 'EMAIL', 'API')),
  direction text NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  sender_type text NOT NULL CHECK (sender_type IN ('CUSTOMER', 'AI', 'HUMAN', 'SYSTEM')),
  content text NOT NULL,
  external_message_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_tenant_external_id
  ON messages (tenant_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_sent
  ON messages (conversation_id, sent_at ASC);

CREATE TABLE IF NOT EXISTS automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  correlation_id text NOT NULL,
  idempotency_key text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD_LETTER', 'CANCELLED')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS commercial_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('PAYMENT', 'SALE', 'INVENTORY_RESERVATION', 'ENROLLMENT', 'HUMAN_HANDOFF')),
  summary text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING_VALIDATION' CHECK (status IN ('PENDING_VALIDATION', 'APPROVED', 'REJECTED')),
  external_system text NOT NULL DEFAULT 'EXTERNAL',
  external_reference_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commercial_approvals_tenant_status
  ON commercial_approvals (tenant_id, status, created_at DESC);

-- Enable & Force Row Level Security on every tenant-scoped table
ALTER TABLE channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_connections FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS channel_connections_isolation ON channel_connections;
CREATE POLICY channel_connections_isolation ON channel_connections FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_agents_isolation ON ai_agents;
CREATE POLICY ai_agents_isolation ON ai_agents FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS knowledge_documents_isolation ON knowledge_documents;
CREATE POLICY knowledge_documents_isolation ON knowledge_documents FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contacts_isolation ON contacts;
CREATE POLICY contacts_isolation ON contacts FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conversations_isolation ON conversations;
CREATE POLICY conversations_isolation ON conversations FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_isolation ON messages;
CREATE POLICY messages_isolation ON messages FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS automation_executions_isolation ON automation_executions;
CREATE POLICY automation_executions_isolation ON automation_executions FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE commercial_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_approvals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS commercial_approvals_isolation ON commercial_approvals;
CREATE POLICY commercial_approvals_isolation ON commercial_approvals FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

-- Harden Supabase anon role & grant restricted app role permissions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE
      channel_connections, ai_agents, knowledge_documents,
      contacts, conversations, messages, automation_executions, commercial_approvals
    FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rsd_sync_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      channel_connections, ai_agents, knowledge_documents,
      contacts, conversations, messages, automation_executions, commercial_approvals
    TO rsd_sync_app;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END
$$;

-- Security-definer routing helpers so webhook ingestion and tenant lookup
-- resolve tenant UUIDs without bypassing RLS on arbitrary tenant data.
CREATE OR REPLACE FUNCTION resolve_channel_tenant(p_channel text, p_external_account_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT tenant_id
  FROM channel_connections
  WHERE channel = p_channel
    AND external_account_id = p_external_account_id
    AND status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION resolve_tenant_id_by_slug(p_slug text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id
  FROM tenants
  WHERE slug = p_slug
  LIMIT 1;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION resolve_channel_tenant(text, text) FROM anon;
    REVOKE ALL ON FUNCTION resolve_tenant_id_by_slug(text) FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rsd_sync_app') THEN
    GRANT EXECUTE ON FUNCTION resolve_channel_tenant(text, text) TO rsd_sync_app;
    GRANT EXECUTE ON FUNCTION resolve_tenant_id_by_slug(text) TO rsd_sync_app;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END
$$;
