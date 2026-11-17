import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
    } else if (entry.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Architectural Boundaries & Multi-Tenant SQL Foundation', () => {
  const corePackages = [
    'automation-core',
    'ai-engine',
    'crm-core',
    'security',
    'database',
    'queue',
  ];

  it('guarantees core domain packages never depend on @rsd-sync/integrations or SUMAK logic', () => {
    for (const pkg of corePackages) {
      const srcDir = join(rootDir, 'packages', pkg, 'src');
      const files = collectTsFiles(srcDir);
      expect(files.length).toBeGreaterThan(0);

      for (const file of files) {
        const content = readFileSync(file, 'utf8');
        expect(content).not.toContain('@rsd-sync/integrations');
        expect(/\bsumak\b/i.test(content)).toBe(false);
        expect(/\bsumac\b/i.test(content)).toBe(false);
      }
    }
  });

  it('verifies foundational SQL migration enables pgvector and strict tenant RLS', () => {
    const migrationPath = join(
      rootDir,
      'packages/database/migrations/0001_phase0_foundation.sql',
    );
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS vector;');
    expect(sql).toContain('app_current_tenant_id()');
    expect(sql).toContain('ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE tenants FORCE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;');
  });
});
