import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserPermissionsCached } from '@/lib/server-permissions';
import { SidebarAdmin } from '@/components/layout/SidebarAdmin';
import { SidebarProvider } from '@/components/layout/SidebarContext';
import { Topbar } from '@/components/layout/Topbar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const permissions = await getCurrentUserPermissionsCached(supabase);

  if (!permissions.includes('menu:admin')) {
    redirect('/marketplace');
  }

  let user: { email?: string; name?: string } | null = null;
  if (authUser) {
    const { data: profile } = await supabase.from('users').select('name').eq('id', authUser.id).single();
    user = {
      email: authUser.email ?? undefined,
      name: (profile as { name?: string })?.name,
    };
  }

  return (
    <SidebarProvider>
      <div className="flex h-dvh overflow-hidden">
        <SidebarAdmin permissions={permissions} />
        <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
          <Topbar permissions={permissions} user={user} variant="admin" />
          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
