import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { getAdminSession } from '@/lib/auth';
import { getAdminServerConfig } from '@/lib/server-config';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getAdminSession();
  if (session.authenticated) {
    redirect('/');
  }

  const config = getAdminServerConfig();

  return (
    <LoginForm
      mode={session.mode}
      supabaseUrl={config.supabasePublicUrl}
      supabaseAnonKey={config.supabaseAnonKey}
      reason={session.reason}
    />
  );
}
