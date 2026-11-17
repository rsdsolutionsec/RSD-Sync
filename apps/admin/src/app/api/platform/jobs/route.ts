import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enqueuePlatformTestJob, fetchPlatformJobs } from '@/lib/api-client';
import { getAdminSession } from '@/lib/auth';

const CreateJobRequestSchema = z.object({
  message: z.string().trim().min(1).max(500).default('ping'),
  shouldFail: z.boolean().default(false),
  delayMs: z.coerce.number().int().nonnegative().max(10000).default(0),
});

export async function GET() {
  const session = await getAdminSession();
  if (!session.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await fetchPlatformJobs(session);
  return NextResponse.json(result, { status: 200 });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = CreateJobRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Datos inválidos para el trabajo de prueba.' },
      { status: 400 },
    );
  }

  const result = await enqueuePlatformTestJob(session, parsed.data);
  return NextResponse.json(result, { status: result.ok ? 202 : 502 });
}
