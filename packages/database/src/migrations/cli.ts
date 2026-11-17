import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalEnvIfPresent, parsePlatformConfig } from '@rsd-sync/configuration';
import { PostgresDatabaseClient } from '../clients/postgres-client.js';
import { runSqlMigrations } from './runner.js';

async function main(): Promise<void> {
  loadLocalEnvIfPresent();
  const config = parsePlatformConfig();
  const db = PostgresDatabaseClient.fromPlatformConfig(config, { useDirectConnection: true });

  const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../migrations');

  try {
    const result = await runSqlMigrations(db, migrationsDir);
    console.log(
      JSON.stringify({
        target: db.target,
        applied: result.applied,
        skipped: result.skipped,
      }),
    );
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error('Migration execution failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
