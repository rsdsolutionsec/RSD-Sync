import { createHmac, timingSafeEqual } from 'node:crypto';

export const DEV_SESSION_COOKIE = 'rsd_sync_dev_session';

interface DevSessionPayload {
  readonly email: string;
  readonly exp: number;
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload, 'utf8').digest('base64url');
}

export function createSignedDevSessionToken(email: string, secret: string): string {
  const payload: DevSessionPayload = {
    email: email.toLowerCase(),
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = signPayload(encoded, secret);
  return `${encoded}.${signature}`;
}

export function verifySignedDevSessionToken(
  token: string | undefined,
  secret: string,
  allowedEmails: readonly string[],
): string | null {
  if (!token) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const encoded = parts[0];
  const signature = parts[1];
  if (!encoded || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encoded, secret);
  const actualBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');

  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as DevSessionPayload;

    if (!parsed.email || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }

    const normalizedEmail = parsed.email.toLowerCase();
    if (allowedEmails.length > 0 && !allowedEmails.includes(normalizedEmail)) {
      return null;
    }

    return normalizedEmail;
  } catch {
    return null;
  }
}
