// src/components/layout/SidebarServer.tsx
import { Sidebar } from './Sidebar';
import { createClient } from '@/lib/supabase/server';

export async function SidebarServer() {
  const supabase = await createClient();

  let permissions: string[] = [];

  try {
    const { data } = await supabase.rpc('current_user_permissions');
    permissions = (data as string[]) ?? [];
  } catch {
    permissions = [];
  }

  return <Sidebar permissions={permissions} />;
}

