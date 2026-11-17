import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { DashboardView } from '@/components/dashboard-view';
import { fetchPlatformStatus } from '@/lib/api-client';
import { getAdminSession } from '@/lib/auth';
import { getAdminServerConfig } from '@/lib/server-config';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getAdminSession();
  if (!session.authenticated) {
    redirect('/login');
  }

  const config = getAdminServerConfig();
  const initialStatus = await fetchPlatformStatus(session);

  return (
    <AdminShell
      email={session.email ?? 'operador'}
      authMode={session.mode}
      environment={config.nodeEnv}
    >
      <DashboardView initialStatus={initialStatus} />
    </AdminShell>
  );
}
