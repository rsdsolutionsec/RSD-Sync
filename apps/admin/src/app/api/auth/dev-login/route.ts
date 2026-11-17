import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSignedDevSessionToken, DEV_SESSION_COOKIE } from '@/lib/auth';
import { getAdminServerConfig } from '@/lib/server-config';

const DevLoginSchema = z.object({
  email: z.string().email(),
  accessKey: z.string().min(8),
});

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: Request) {
  const config = getAdminServerConfig();

  if (config.nodeEnv === 'production' || config.isSupabaseAuthConfigured) {
    return NextResponse.json(
      { error: 'El acceso local de desarrollo está deshabilitado en este entorno.' },
      { status: 403 },
    );
  }

  if (!config.devAdminAccessKey) {
    return NextResponse.json(
      { error: 'DEV_ADMIN_ACCESS_KEY no está configurado en el servidor.' },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = DevLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Ingresa un correo válido y la clave de acceso.' },
      { status: 400 },
    );
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  if (config.adminEmails.length > 0 && !config.adminEmails.includes(normalizedEmail)) {
    return NextResponse.json(
      { error: 'Correo no autorizado en ADMIN_EMAILS.' },
      { status: 403 },
    );
  }

  if (!safeEqual(parsed.data.accessKey, config.devAdminAccessKey)) {
    return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
  }

  const token = createSignedDevSessionToken(normalizedEmail, config.sessionSigningSecret);
  const response = NextResponse.json({ ok: true, email: normalizedEmail });
  response.cookies.set(DEV_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 60 * 60 * 12,
  });

  return response;
}
