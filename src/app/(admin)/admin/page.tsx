import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserPermissionsCached } from '@/lib/server-permissions';

export default async function AdminPage() {
  const supabase = await createClient();
  const permissions = await getCurrentUserPermissionsCached(supabase);

  if (!permissions.includes('menu:admin')) redirect('/marketplace');
  redirect('/admin/catalog');
}
