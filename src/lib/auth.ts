import { createClient } from '@/lib/supabase/server';

export type UserProfile = {
  id: string;
  name: string;
  username: string;
  roleKey: string;
  permissions: string[];
};

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('id, name, username, role_id')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  const { data: role } = await supabase
    .from('roles')
    .select('key')
    .eq('id', profile.role_id)
    .single();
  const roleKey = role?.key ?? 'user';
  const { data: perms } = await supabase.rpc('current_user_permissions');
  const permissions = (perms as string[]) ?? [];

  return {
    id: profile.id,
    name: profile.name,
    username: profile.username,
    roleKey,
    permissions,
  };
}

export function canAccessAdmin(roleKey: string): boolean {
  return roleKey === 'superadmin' || roleKey === 'treasurer';
}
