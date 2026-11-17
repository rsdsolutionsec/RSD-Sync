import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PostgresDatabaseClient } from '../clients/postgres-client.js';

export interface MigrationRunResult {
  readonly applied: readonly string[];
  readonly skipped: readonly string[];
}

export async function runSqlMigrations(
  db: PostgresDatabaseClient,
  migrationsDir: string,
): Promise<MigrationRunResult> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS rsd_schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const appliedResult = await db.query<{ filename: string }>(
    'SELECT filename FROM rsd_schema_migrations ORDER BY filename ASC',
  );
  const alreadyApplied = new Set(appliedResult.rows.map((row) => row.filename));

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const filename of files) {
    if (alreadyApplied.has(filename)) {
      skipped.push(filename);
      continue;
    }

    const sql = readFileSync(join(migrationsDir, filename), 'utf8');
    await db.query('BEGIN');
    try {
      await db.query(sql);
      await db.query(
        'INSERT INTO rsd_schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
        [filename],
      );
      await db.query('COMMIT');
      applied.push(filename);
    } catch (error) {
      await db.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  return { applied, skipped };
}
