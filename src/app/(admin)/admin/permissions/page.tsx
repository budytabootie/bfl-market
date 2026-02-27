'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';

type Role = { id: string; key: string; name: string };
type Perm = { role_id: string; permission: string };

const MENU_PERMS = [
  'menu:admin', 'menu:catalog', 'menu:warehouse', 'menu:weapons', 'menu:orders',
  'menu:users', 'menu:permissions', 'menu:activity', 'menu:marketplace', 'menu:my-orders',
];

export default function AdminPermissionsPage() {
  const supabase = createClient();
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [loading, setLoading] = useState(true);

  const has = (roleId: string, p: string) => perms.some((x) => x.role_id === roleId && x.permission === p);

  async function load() {
    const { data: r } = await supabase.from('roles').select('*');
    setRoles((r ?? []) as unknown as Role[]);
    const { data: p } = await supabase.from('role_permissions').select('role_id, permission');
    setPerms((p ?? []) as unknown as Perm[]);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function toggle(roleId: string, permission: string) {
    if (has(roleId, permission)) {
      await supabase.from('role_permissions').delete().eq('role_id', roleId).eq('permission', permission);
    } else {
      await supabase.from('role_permissions').insert({ role_id: roleId, permission });
    }
    load();
  }

  if (loading) return <Card title="Role Permissions"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <Card title="Role Permissions (Superadmin only)">
      <div className="overflow-x-auto text-xs">
        <table className="w-full">
          <thead>
            <tr className="text-slate-400">
              <th className="p-2 text-left">Role</th>
              {MENU_PERMS.map((p) => <th key={p} className="p-2 text-center">{p.replace('menu:', '')}</th>)}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="border-t border-slate-800">
                <td className="p-2">{role.name}</td>
                {MENU_PERMS.map((p) => (
                  <td key={p} className="p-2 text-center">
                    <input type="checkbox" checked={has(role.id, p)} onChange={() => toggle(role.id, p)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
