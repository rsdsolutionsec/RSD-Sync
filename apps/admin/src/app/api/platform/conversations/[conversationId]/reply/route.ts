import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendHumanConversationReplyApi } from '@/lib/api-client';
import { getAdminSession } from '@/lib/auth';

const ReplyBodySchema = z.object({
  textBody: z.string().trim().min(1).max(4000),
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
  const parsed = ReplyBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Mensaje inválido.' }, { status: 400 });
  }

  const { conversationId } = await context.params;
  const result = await sendHumanConversationReplyApi(session, conversationId, parsed.data.textBody);
  return NextResponse.json(result, { status: result.ok ? 202 : 502 });
}
