import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = dirname(fileURLToPath(import.meta.url));

const packageAliases = [
  'shared',
  'contracts',
  'configuration',
  'observability',
  'security',
  'queue',
  'database',
  'automation-core',
  'ai-engine',
  'crm-core',
  'integrations',
];

const appAliases = ['api', 'worker', 'admin'];

const alias = {
  ...Object.fromEntries(
    packageAliases.map((pkg) => [
      `@rsd-sync/${pkg}`,
      resolve(rootDir, `packages/${pkg}/src/index.ts`),
    ]),
  ),
  ...Object.fromEntries(
    appAliases.map((app) => [
      `@rsd-sync/${app}`,
      resolve(rootDir, `apps/${app}/src/index.ts`),
    ]),
  ),
};

export default defineConfig({
  resolve: {
    alias,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    fileParallelism: false,
  },
});
