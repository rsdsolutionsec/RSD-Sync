import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { ConversationsView } from '@/components/conversations-view';
import { fetchConversations } from '@/lib/api-client';
import { getAdminSession } from '@/lib/auth';
import { getAdminServerConfig } from '@/lib/server-config';

export const dynamic = 'force-dynamic';

export default async function ConversationsPage() {
  const session = await getAdminSession();
  if (!session.authenticated) {
    redirect('/login');
  }

  const config = getAdminServerConfig();
  const initialData = await fetchConversations(session);

  return (
    <AdminShell
      email={session.email ?? 'operador'}
      authMode={session.mode}
      environment={config.nodeEnv}
    >
      <ConversationsView
        initialConversations={initialData.conversations}
        initialTenantSlug={initialData.tenantSlug}
        initialError={initialData.error}
      />
    </AdminShell>
  );
}
