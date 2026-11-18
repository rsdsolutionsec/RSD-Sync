import { NextResponse } from 'next/server';
import { fetchConversationDetail } from '@/lib/api-client';
import { getAdminSession } from '@/lib/auth';

export async function GET(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const session = await getAdminSession();
  if (!session.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { conversationId } = await context.params;
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get('tenantSlug') ?? undefined;
  const result = await fetchConversationDetail(session, conversationId, tenantSlug);
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
