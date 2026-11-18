import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateConversationModeApi } from '@/lib/api-client';
import { getAdminSession } from '@/lib/auth';

const ModeBodySchema = z.object({
  mode: z.enum(['AI', 'HUMAN', 'COPILOT']),
  reason: z.string().trim().max(300).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const session = await getAdminSession();
  if (!session.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = ModeBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Modo inválido.' }, { status: 400 });
  }

  const { conversationId } = await context.params;
  const result = await updateConversationModeApi(session, conversationId, parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
