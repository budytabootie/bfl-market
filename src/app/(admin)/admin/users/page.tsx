'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
type UserRow = {
  id: string;
  name: string;
  username: string;
  discord_id: string | null;
  role_id: string;
  roles: { key: string; name: string } | null;
  must_change_password?: boolean;
};

type Role = { id: string; key: string; name: string };

export default function AdminUsersPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [roleId, setRoleId] = useState('');
  const [discordId, setDiscordId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRoleId, setEditRoleId] = useState('');
  const [editDiscordId, setEditDiscordId] = useState('');

  async function load() {
    setError(null);
    const errs: string[] = [];
    const { data: u, error: uErr } = await supabase.from('users').select('id, name, username, discord_id, role_id, must_change_password, roles(key, name)');
    if (uErr) {
      errs.push(`users: ${uErr.message}`);
      setUsers([]);
    } else {
      setUsers((u ?? []) as unknown as UserRow[]);
    }
    const { data: r, error: rErr } = await supabase.from('roles').select('id, key, name');
    if (rErr) {
      errs.push(`roles: ${rErr.message}`);
      setRoles([]);
    } else {
      setRoles((r ?? []) as unknown as Role[]);
    }
    if (errs.length) setError(`Gagal load: ${errs.join('; ')}`);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        username: username.trim().toLowerCase(),
        role_id: roleId,
        discord_id: discordId || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? 'Failed');
      return;
    }
    setName('');
    setUsername('');
    setRoleId('');
    setDiscordId('');
    load();
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setEditName(u.name);
    setEditUsername(u.username);
    setEditRoleId(u.role_id);
    setEditDiscordId(u.discord_id ?? '');
    setError(null);
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editing.id,
        name: editName.trim(),
        username: editUsername.trim().toLowerCase(),
        role_id: editRoleId,
        discord_id: editDiscordId || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? 'Gagal update');
      return;
    }
    setEditing(null);
    load();
  }

  async function handleReset(u: UserRow) {
    const msg = u.discord_id
      ? `Reset password untuk "${u.name}" (${u.username})? Password baru akan dikirim via Discord DM.`
      : `Reset password untuk "${u.name}" (${u.username})? Warning: User belum punya Discord ID, DM tidak akan terkirim.`;
    if (!confirm(msg)) return;
    setError(null);
    const res = await fetch('/api/admin/users/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? 'Gagal reset password');
      return;
    }
    load();
  }

  async function handleDelete(u: UserRow) {
    if (!confirm(`Hapus user "${u.name}" (${u.username})?`)) return;
    setError(null);
    const res = await fetch(`/api/admin/users?id=${u.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? 'Gagal hapus');
      return;
    }
    load();
  }

  if (loading) return <Card title="User Management"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <>
      {error && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
          <p className="mt-2 text-xs text-amber-300/80">
            Jika error timeout/500: jalankan migration fix RLS di Supabase SQL Editor (fix_rls_recursion.sql)
          </p>
        </div>
      )}
    <div className="space-y-6">
      <Card title="Create User">
        <p className="mb-3 text-xs text-slate-400">Password 6 digit akan di-generate otomatis dan dikirim via Discord DM (wajib isi Discord ID).</p>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-3">
          <input className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <select className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">Role</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm" placeholder="Discord ID (untuk kirim credentials via DM)" value={discordId} onChange={(e) => setDiscordId(e.target.value)} />
          <Button type="submit">Create</Button>
        </form>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </Card>
      <Card title="Users">
        <div className="overflow-x-auto text-xs">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400">
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Username</th>
                <th className="p-2 text-left">Role</th>
                <th className="p-2 text-left">Discord</th>
                <th className="p-2 text-left">Password</th>
                <th className="p-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-800">
                  <td className="p-2">{u.name}</td>
                  <td className="p-2">{u.username}</td>
                  <td className="p-2">{(u.roles as { key?: string; name?: string })?.name ?? (u.roles as { key?: string })?.key ?? '-'}</td>
                  <td className="p-2">{u.discord_id ?? '-'}</td>
                  <td className="p-2">
                    {u.must_change_password ? (
                      <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">Perlu ganti</span>
                    ) : (
                      <span className="text-slate-500">Sudah ganti</span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <button type="button" className="text-bfl-primary hover:underline mr-2" onClick={() => openEdit(u)}>Edit</button>
                    <button type="button" className="text-slate-400 hover:underline mr-2" onClick={() => handleReset(u)}>Reset Password</button>
                    <button type="button" className="text-red-400 hover:underline" onClick={() => handleDelete(u)}>Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
          <Card title="Edit User" className="w-full">
            <form onSubmit={handleEdit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Name</label>
                <input className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm" value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs text-slate-400">Username</label>
                <input className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs text-slate-400">Role</label>
                <select className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm" value={editRoleId} onChange={(e) => setEditRoleId(e.target.value)} required>
                  <option value="">Pilih Role</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Discord ID</label>
                <input className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm" value={editDiscordId} onChange={(e) => setEditDiscordId(e.target.value)} placeholder="Opsional" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit">Simpan</Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Batal</Button>
              </div>
            </form>
          </Card>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
