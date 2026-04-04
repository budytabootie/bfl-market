import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserPermissionsCached } from '@/lib/server-permissions';
import { ChoosePanelClient } from './ChoosePanelClient';

export default async function ChoosePanelPage() {
  const supabase = await createClient();
  const permissions = await getCurrentUserPermissionsCached(supabase);
  const canAdmin = permissions.includes('menu:admin');

  if (!canAdmin) {
    redirect('/marketplace');
  }

  return <ChoosePanelClient initialCanAdmin={true} />;
}
