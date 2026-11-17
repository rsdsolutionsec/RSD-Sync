import { NextResponse } from 'next/server';
import { fetchPlatformJobById } from '@/lib/api-client';
import { getAdminSession } from '@/lib/auth';

export async function GET(
  _request: Request,
  context: { readonly params: Promise<{ readonly jobId: string }> },
) {
  const session = await getAdminSession();
  if (!session.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await context.params;
  const result = await fetchPlatformJobById(session, jobId);
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
