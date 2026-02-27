import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { SidebarAdmin } from '@/components/layout/SidebarAdmin';
import { Topbar } from '@/components/layout/Topbar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: perms } = await supabase.rpc('current_user_permissions');
  const permissions = (perms as string[]) ?? [];

  if (!permissions.includes('menu:admin')) {
    redirect('/marketplace');
  }

  const headersList = await headers();
  const userEmail = headersList.get('x-bfl-user-email');
  const user = userEmail ? { email: userEmail } : null;

  return (
    <div className="flex min-h-screen">
      <SidebarAdmin permissions={permissions} />
      <div className="flex flex-1 flex-col">
        <Topbar permissions={permissions} user={user} variant="admin" />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
