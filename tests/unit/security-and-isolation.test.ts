import {
  assertCanExecuteAction,
  assertTenantIsolation,
  canExecuteAction,
  computeHmacSha256Signature,
  decryptSecret,
  encryptSecret,
  verifyHmacSignature,
} from '@rsd-sync/security';
import {
  asTenantId,
  TenantIsolationError,
  UnauthorizedOperationError,
} from '@rsd-sync/shared';
import { describe, expect, it } from 'vitest';

describe('Security, Tenant Isolation, Cryptography & RBAC', () => {
  const tenantA = asTenantId('11111111-1111-4111-8111-111111111111');
  const tenantB = asTenantId('22222222-2222-4222-8222-222222222222');

  it('enforces strict tenant isolation boundaries', () => {
    expect(() => assertTenantIsolation(tenantA, tenantA, 'conversation')).not.toThrow();
    expect(() => assertTenantIsolation(tenantA, tenantB, 'conversation')).toThrow(
      TenantIsolationError,
    );
  });

  it('encrypts and decrypts tenant secrets with AES-256-GCM and AAD tenant binding', () => {
    const masterKey = 'test-master-encryption-key-at-least-32-chars';
    const plaintext = 'whatsapp-token-value-12345';

    const encrypted = encryptSecret(plaintext, masterKey, tenantA);
    expect(encrypted.ciphertext).not.toContain(plaintext);

    const decrypted = decryptSecret(encrypted, masterKey, tenantA);
    expect(decrypted).toBe(plaintext);

    // Ciphertext bound to tenantA must fail decryption when validated under tenantB
    expect(() => decryptSecret(encrypted, masterKey, tenantB)).toThrow();
    // Wrong master key must fail decryption
    expect(() => decryptSecret(encrypted, 'wrong-master-encryption-key-32-chars', tenantA)).toThrow();
  });

  it('verifies webhook HMAC-SHA256 signatures in constant time', () => {
    const secret = 'webhook-secret-xyz';
    const payload = JSON.stringify({ event: 'message', id: 'wamid.123' });
    const signature = computeHmacSha256Signature(payload, secret);

    expect(
      verifyHmacSignature({
        payload,
        signatureHeader: signature,
        secret,
      }),
    ).toBe(true);

    expect(
      verifyHmacSignature({
        payload,
        signatureHeader: 'sha256=deadbeef',
        secret,
      }),
    ).toBe(false);

    expect(
      verifyHmacSignature({
        payload,
        signatureHeader: undefined,
        secret,
      }),
    ).toBe(false);
  });

  it('enforces RBAC permissions across human and AI roles', () => {
    expect(canExecuteAction('SECRETARY', 'conversations:takeover')).toBe(true);
    expect(canExecuteAction('SECRETARY', 'secrets:manage')).toBe(false);
    expect(canExecuteAction('TENANT_ADMIN', 'secrets:manage')).toBe(true);
    expect(canExecuteAction('AI_AGENT', 'tools:read_only')).toBe(true);
    expect(canExecuteAction('AI_AGENT', 'conversations:takeover')).toBe(false);

    expect(() => assertCanExecuteAction('AI_AGENT', 'secrets:manage')).toThrow(
      UnauthorizedOperationError,
    );
  });
});
