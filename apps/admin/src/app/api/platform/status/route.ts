import { NextResponse } from 'next/server';
import { fetchPlatformStatus } from '@/lib/api-client';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  const session = await getAdminSession();
  if (!session.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = await fetchPlatformStatus(session);
  return NextResponse.json(status, { status: 200 });
}
