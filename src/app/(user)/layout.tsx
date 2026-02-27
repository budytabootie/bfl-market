import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { SidebarUser } from '@/components/layout/SidebarUser';
import { Topbar } from '@/components/layout/Topbar';

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const userEmail = headersList.get('x-bfl-user-email');
  const user = userEmail ? { email: userEmail } : null;

  const supabase = await createClient();
  const { data: perms } = await supabase.rpc('current_user_permissions');
  const permissions = (perms as string[]) ?? [];

  return (
    <div className="flex min-h-screen">
      <SidebarUser permissions={permissions} />
      <div className="flex flex-1 flex-col">
        <Topbar permissions={permissions} user={user} variant="user" />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
