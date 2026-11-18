import { NextResponse } from 'next/server';
import { z } from 'zod';
import { simulateWhatsappInbound } from '@/lib/api-client';
import { getAdminSession } from '@/lib/auth';

const SimulateSchema = z.object({
  fromPhoneE164: z.string().trim().min(6).max(30),
  contactName: z.string().trim().max(120).optional(),
  textBody: z.string().trim().min(1).max(4000),
});

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = SimulateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Teléfono o mensaje inválido.' },
      { status: 400 },
    );
  }

  const result = await simulateWhatsappInbound(session, parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
