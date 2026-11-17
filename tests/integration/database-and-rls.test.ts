import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePlatformConfig } from '@rsd-sync/configuration';
import {
  PostgresDatabaseClient,
  runSqlMigrations,
  SupabaseConnector,
} from '@rsd-sync/database';
import { asTenantId } from '@rsd-sync/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDir = resolve(rootDir, 'packages/database/migrations');

describe('PostgreSQL Local Database, Migrations, RLS & Supabase Readiness', () => {
  const config = parsePlatformConfig({
    DATABASE_TARGET: 'local',
    DATABASE_URL: 'postgresql://rsd_sync:rsd_sync_dev_password@127.0.0.1:54332/rsd_sync_dev',
  });
  const db = PostgresDatabaseClient.fromPlatformConfig(config);

  beforeAll(async () => {
    await runSqlMigrations(db, migrationsDir);
  });

  afterAll(async () => {
    await db.close();
  });

  it('connects to local PostgreSQL container and applies versioned SQL migrations', async () => {
    const diagnostic = await db.diagnose();
    expect(diagnostic.connected).toBe(true);
    expect(diagnostic.target).toBe('local');

    const migrations = await db.query<{ filename: string }>(
      'SELECT filename FROM rsd_schema_migrations ORDER BY filename ASC',
    );
    expect(migrations.rows.map((r) => r.filename)).toEqual([
      '0001_phase0_foundation.sql',
      '0002_phase1_supabase_hardening.sql',
    ]);
  });

  it('enforces Row Level Security across tenants under non-superuser rsd_sync_app role', async () => {
    const tenantA = asTenantId(randomUUID());
    const tenantB = asTenantId(randomUUID());

    await db.query('INSERT INTO tenants (id, slug, name) VALUES ($1, $2, $3)', [
      tenantA,
      `test-a-${tenantA.slice(0, 8)}`,
      'Tenant A',
    ]);
    await db.query('INSERT INTO tenants (id, slug, name) VALUES ($1, $2, $3)', [
      tenantB,
      `test-b-${tenantB.slice(0, 8)}`,
      'Tenant B',
    ]);

    try {
      await db.withTenantTransaction(tenantA, async (tx) => {
        await tx.query('SET LOCAL ROLE rsd_sync_app');

        const visibleTenants = await tx.query<{ id: string }>('SELECT id FROM tenants');
        expect(visibleTenants.rows.map((r) => r.id)).toEqual([tenantA]);

        // Writing audit log for Tenant A succeeds
        await tx.query(
          `INSERT INTO audit_logs (tenant_id, actor_id, actor_role, action, resource_type, correlation_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [tenantA, 'tester', 'OPERATOR', 'rls.test', 'tenant', 'corr-a'],
        );

        // Attempting to write audit log for Tenant B while scoped to Tenant A is blocked by RLS
        await expect(
          tx.query(
            `INSERT INTO audit_logs (tenant_id, actor_id, actor_role, action, resource_type, correlation_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [tenantB, 'tester', 'OPERATOR', 'rls.bypass', 'tenant', 'corr-b'],
          ),
        ).rejects.toThrow();
      });
    } finally {
      await db.query('DELETE FROM tenants WHERE id IN ($1, $2)', [tenantA, tenantB]);
    }
  });

  it('reports Supabase as not_configured when cloud credentials are omitted', async () => {
    const supabase = new SupabaseConnector(config);
    const status = await supabase.checkConnectivity();
    expect(status.configured).toBe(false);
    expect(status.status).toBe('not_configured');
  });
});
