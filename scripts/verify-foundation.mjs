import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));

const requiredRootFiles = [
  'AGENTS.md',
  'README.md',
  'ROADMAP.md',
  'ARCHITECTURE.md',
  'DECISIONS.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'docker-compose.yml',
  'pnpm-workspace.yaml',
  'package.json',
  'tsconfig.base.json',
  'tsconfig.json',
  'vitest.config.ts',
  '.env.example',
  '.gitignore',
  '.github/workflows/ci.yml',
];

const requiredDocFiles = [
  'docs/architecture/system-overview.md',
  'docs/development/local-setup.md',
  'docs/api/contracts-and-conventions.md',
  'docs/database/persistence-and-migrations.md',
  'docs/security/security-model.md',
  'docs/integrations/sumak-integration.md',
  'docs/operations/docker-and-deployment.md',
  'docs/phases/README.md',
];

const requiredWorkspaces = [
  'apps/api',
  'apps/worker',
  'apps/admin',
  'packages/shared',
  'packages/contracts',
  'packages/configuration',
  'packages/observability',
  'packages/security',
  'packages/queue',
  'packages/database',
  'packages/automation-core',
  'packages/ai-engine',
  'packages/crm-core',
  'packages/integrations',
];

const errors = [];

for (const file of [...requiredRootFiles, ...requiredDocFiles]) {
  if (!existsSync(join(rootDir, file))) {
    errors.push(`Missing required file: ${file}`);
  }
}

for (const ws of requiredWorkspaces) {
  if (!existsSync(join(rootDir, ws, 'package.json'))) {
    errors.push(`Missing workspace package.json: ${ws}/package.json`);
  }
}

// Ensure no nested RSD-SYNC directory exists
if (existsSync(join(rootDir, 'RSD-SYNC')) || existsSync(join(rootDir, 'RSD Sync'))) {
  errors.push('Forbidden nested RSD-SYNC directory detected.');
}

// Ensure no .env file is tracked by git
try {
  const tracked = execSync('git ls-files', { cwd: rootDir, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);
  for (const file of tracked) {
    if (file === '.env' || (file.startsWith('.env.') && file !== '.env.example')) {
      errors.push(`Tracked secret environment file detected: ${file}`);
    }
  }
} catch {
  errors.push('Unable to inspect tracked git files.');
}

// Verify Docker Compose binds exposed ports to 127.0.0.1
if (existsSync(join(rootDir, 'docker-compose.yml'))) {
  const composeContent = readFileSync(join(rootDir, 'docker-compose.yml'), 'utf8');
  const portLines = composeContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^-\s*["']?[\d.${}]+:/.test(line) && line.includes(':'));
  for (const line of portLines) {
    if (!line.includes('127.0.0.1:')) {
      errors.push(`Docker Compose port mapping must bind to 127.0.0.1: ${line}`);
    }
  }
}

// Verify correct spelling SUMAK (never SUMAC as an identifier or client name)
const codeScanDirs = ['apps', 'packages', 'tests', 'infrastructure', 'scripts'];
const textExts = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.sql', '.yml', '.yaml', '.md']);

function walk(dir) {
  if (!existsSync(dir)) return [];
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walk(full));
    } else if (textExts.has(extname(full))) {
      results.push(full);
    }
  }
  return results;
}

for (const dir of codeScanDirs) {
  for (const file of walk(join(rootDir, dir))) {
    const rel = relative(rootDir, file).replace(/\\/g, '/');
    if (rel === 'scripts/verify-foundation.mjs') continue;
    const content = readFileSync(file, 'utf8');
    if (/\bsumac\b/i.test(content)) {
      errors.push(`Invalid client spelling "SUMAC" found in ${rel}; must be "SUMAK".`);
    }
  }
}

// Verify docs only mention SUMAC when explicitly warning against the misspelling
for (const file of [...walk(join(rootDir, 'docs')), ...requiredRootFiles.filter((f) => f.endsWith('.md')).map((f) => join(rootDir, f))]) {
  if (!existsSync(file)) continue;
  const rel = relative(rootDir, file).replace(/\\/g, '/');
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\bsumac\b/i.test(line) && !/(no\s+["`*]*sumac|nunca\s+["`*]*sumac|not\s+["`*]*sumac)/i.test(line)) {
      errors.push(`Invalid client spelling "SUMAC" found in ${rel}:${index + 1}; must be "SUMAK".`);
    }
  });
}

if (errors.length > 0) {
  console.error('Foundation verification failed:');
  for (const error of errors) {
    console.error(` - ${error}`);
  }
  process.exit(1);
}

console.log('RSD Sync foundation verification passed.');
