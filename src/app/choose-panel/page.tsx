import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ChoosePanelClient } from './ChoosePanelClient';

export default async function ChoosePanelPage() {
  const supabase = await createClient();
  const { data: perms } = await supabase.rpc('current_user_permissions');
  const permissions = (perms as string[]) ?? [];
  const canAdmin = permissions.includes('menu:admin');

  if (!canAdmin) {
    redirect('/marketplace');
  }

  return <ChoosePanelClient initialCanAdmin={true} />;
}
