import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { ValidationError } from '@rsd-sync/shared';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_VERSION = 1;

export interface EncryptedSecretPayload {
  readonly keyVersion: number;
  readonly iv: string;
  readonly authTag: string;
  readonly ciphertext: string;
}

function deriveAes256Key(masterKey: string): Buffer {
  if (masterKey.trim().length < 16) {
    throw new ValidationError('Master encryption key must be at least 16 characters');
  }
  return createHash('sha256').update(masterKey, 'utf8').digest();
}

export function encryptSecret(
  plaintext: string,
  masterKey: string,
  associatedData?: string,
): EncryptedSecretPayload {
  if (plaintext.length === 0) {
    throw new ValidationError('Secret plaintext cannot be empty');
  }

  const key = deriveAes256Key(masterKey);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  if (associatedData !== undefined) {
    cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  }

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    keyVersion: KEY_VERSION,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
}

export function decryptSecret(
  payload: EncryptedSecretPayload,
  masterKey: string,
  associatedData?: string,
): string {
  const key = deriveAes256Key(masterKey);
  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  if (associatedData !== undefined) {
    decipher.setAAD(Buffer.from(associatedData, 'utf8'));
  }

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
