import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { InfrastructureView } from '@/components/infrastructure-view';
import { fetchPlatformStatus } from '@/lib/api-client';
import { getAdminSession } from '@/lib/auth';
import { getAdminServerConfig } from '@/lib/server-config';

export const dynamic = 'force-dynamic';

export default async function InfrastructurePage() {
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
      <InfrastructureView
        initialStatus={initialStatus}
        readiness={{
          nodeEnv: config.nodeEnv,
          isVercel: config.isVercel,
          apiUrlConfigured: Boolean(config.apiUrl),
          adminApiKeyConfigured: Boolean(config.adminApiKey),
          adminEmailsCount: config.adminEmails.length,
          supabaseAuthConfigured: config.isSupabaseAuthConfigured,
        }}
      />
    </AdminShell>
  );
}
