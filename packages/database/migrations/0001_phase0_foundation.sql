-- ==============================================================================
-- RSD Sync — Phase 0 Foundation Migration
-- Enables pgcrypto and pgvector, establishes multi-tenant RLS context helpers,
-- and creates foundational tenants and audit_logs tables.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE OR REPLACE FUNCTION app_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$;

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  correlation_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
  ON audit_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id
  ON audit_logs (correlation_id);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_isolation_policy ON tenants;
CREATE POLICY tenants_isolation_policy
  ON tenants
  USING (id = app_current_tenant_id());

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_isolation_policy ON audit_logs;
CREATE POLICY audit_logs_isolation_policy
  ON audit_logs
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());
