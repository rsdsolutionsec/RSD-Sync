import { NextResponse } from 'next/server';
import { fetchConversations } from '@/lib/api-client';
import { getAdminSession } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get('tenantSlug') ?? undefined;
  const result = await fetchConversations(session, tenantSlug);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
