import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { JobsView } from '@/components/jobs-view';
import { fetchPlatformJobs } from '@/lib/api-client';
import { getAdminSession } from '@/lib/auth';
import { getAdminServerConfig } from '@/lib/server-config';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  const session = await getAdminSession();
  if (!session.authenticated) {
    redirect('/login');
  }

  const config = getAdminServerConfig();
  const initialJobs = await fetchPlatformJobs(session);

  return (
    <AdminShell
      email={session.email ?? 'operador'}
      authMode={session.mode}
      environment={config.nodeEnv}
    >
      <JobsView
        initialJobs={initialJobs.jobs}
        initialApiAvailable={initialJobs.apiAvailable}
        initialError={initialJobs.error}
      />
    </AdminShell>
  );
}
