import { createClient } from '@/lib/supabase/server';
import { SidebarUser } from '@/components/layout/SidebarUser';
import { Topbar } from '@/components/layout/Topbar';

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { data: perms } = await supabase.rpc('current_user_permissions');
  const permissions = (perms as string[]) ?? [];

  let user: { email?: string; name?: string } | null = null;
  if (authUser) {
    const { data: profile } = await supabase.from('users').select('name').eq('id', authUser.id).single();
    user = {
      email: authUser.email ?? undefined,
      name: (profile as { name?: string })?.name,
    };
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarUser permissions={permissions} />
      <div className="flex flex-1 flex-col min-h-0">
        <Topbar permissions={permissions} user={user} variant="user" />
        <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
