import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getViewRole } from '@/lib/actions/view';
import { getAlertCount } from '@/lib/queries';
import { Header } from '@/components/header';
import { DesktopNav, BottomTabBar } from '@/components/nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const [viewRole, alertCount] = await Promise.all([getViewRole(session.role), getAlertCount()]);

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--surface-page)]">
      <Header displayName={session.displayName} actualRole={session.role} viewRole={viewRole} />
      <DesktopNav viewRole={viewRole} alertCount={alertCount} />
      <main className="flex-1 w-full max-w-[var(--content-max)] mx-auto px-4 sm:px-6 lg:px-16 py-6 pb-24 sm:pb-10">
        {children}
      </main>
      <BottomTabBar viewRole={viewRole} alertCount={alertCount} />
    </div>
  );
}
