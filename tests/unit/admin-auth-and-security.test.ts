import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createSignedDevSessionToken,
  verifySignedDevSessionToken,
} from '../../apps/admin/src/lib/dev-session.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

describe('Admin Session Security & Browser Secret Hygiene', () => {
  const secret = 'test-session-signing-secret-at-least-32-chars';
  const allowlist = ['admin@rsdsolutions.com'];

  it('signs and verifies local dev session tokens strictly against allowlist', () => {
    const token = createSignedDevSessionToken('Admin@RsdSolutions.com', secret);
    expect(verifySignedDevSessionToken(token, secret, allowlist)).toBe('admin@rsdsolutions.com');

    // Tampered token fails verification
    expect(verifySignedDevSessionToken(`${token}tamper`, secret, allowlist)).toBeNull();

    // Wrong signing secret fails verification
    expect(
      verifySignedDevSessionToken(token, 'different-signing-secret-at-least-32-chars', allowlist),
    ).toBeNull();

    // Email not in ADMIN_EMAILS is rejected
    const outsiderToken = createSignedDevSessionToken('intruder@example.com', secret);
    expect(verifySignedDevSessionToken(outsiderToken, secret, allowlist)).toBeNull();
  });

  it('guarantees client/browser admin components never reference backend secrets or SUMAK', () => {
    const componentsDir = join(rootDir, 'apps/admin/src/components');
    const files = collectTsFiles(componentsDir);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(content).not.toContain('ADMIN_API_KEY');
      expect(content).not.toContain('ENCRYPTION_MASTER_KEY');
      expect(content).not.toContain('DEV_ADMIN_ACCESS_KEY');
      expect(/\bsumak\b/i.test(content)).toBe(false);
    }
  });
});
