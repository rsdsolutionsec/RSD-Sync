-- ==============================================================================
-- RSD Sync — Phase 1 Operational & Supabase Compatibility Hardening Migration
-- ==============================================================================

CREATE TABLE IF NOT EXISTS rsd_schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rsd_schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsd_schema_migrations FORCE ROW LEVEL SECURITY;

-- Ensure tenants RLS policy enforces both read and write tenant isolation
DROP POLICY IF EXISTS tenants_isolation_policy ON tenants;
CREATE POLICY tenants_isolation_policy
  ON tenants
  FOR ALL
  USING (id = app_current_tenant_id())
  WITH CHECK (id = app_current_tenant_id());

-- Harden Supabase PostgREST roles when running inside a Supabase project
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE tenants FROM anon;
    REVOKE ALL ON TABLE audit_logs FROM anon;
    REVOKE ALL ON TABLE rsd_schema_migrations FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE rsd_schema_migrations FROM authenticated;
  END IF;
END
$$;

-- Create a restricted non-superuser application role for RLS verification & backend pools
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rsd_sync_app') THEN
    CREATE ROLE rsd_sync_app NOLOGIN NOBYPASSRLS;
  END IF;
  GRANT USAGE ON SCHEMA public TO rsd_sync_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenants TO rsd_sync_app;
  GRANT SELECT, INSERT ON TABLE audit_logs TO rsd_sync_app;
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END
$$;
