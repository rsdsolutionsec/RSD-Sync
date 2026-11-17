import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifyHmacSignatureInput {
  readonly payload: string | Buffer;
  readonly signatureHeader: string | undefined;
  readonly secret: string;
  readonly prefix?: string | undefined;
}

export function computeHmacSha256Signature(
  payload: string | Buffer,
  secret: string,
  prefix = 'sha256=',
): string {
  const digest = createHmac('sha256', secret).update(payload).digest('hex');
  return `${prefix}${digest}`;
}

export function verifyHmacSignature(input: VerifyHmacSignatureInput): boolean {
  if (!input.signatureHeader || input.secret.length === 0) {
    return false;
  }

  const prefix = input.prefix ?? 'sha256=';
  const expected = computeHmacSha256Signature(input.payload, input.secret, prefix);

  const actualBuffer = Buffer.from(input.signatureHeader, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}
