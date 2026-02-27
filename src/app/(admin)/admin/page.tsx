import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: perms } = await supabase.rpc('current_user_permissions');
  const permissions = (perms as string[]) ?? [];

  if (!permissions.includes('menu:admin')) redirect('/marketplace');
  redirect('/admin/catalog');
}
