'use client';

import { useEffect, useState, useCallback, type FormEvent, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TableToolbar } from '@/components/ui/TableToolbar';
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
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filteredUsers = useMemo(() => {
    let r = users;
    const q = search.trim().toLowerCase();
    if (q) {
      r = r.filter((u) => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
    }
    if (filterRole) r = r.filter((u) => u.role_id === filterRole);
    return r;
  }, [users, search, filterRole]);

  const paginatedUsers = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredUsers.slice(from, from + PAGE_SIZE);
  }, [filteredUsers, page]);

  const [resettingId, setResettingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingSubmitting, setEditingSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [confirmReset, setConfirmReset] = useState<UserRow | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [dmChannelId, setDmChannelId] = useState('');
  const [dmSetupLoading, setDmSetupLoading] = useState(false);
  const [currentUserRoleKey, setCurrentUserRoleKey] = useState<string | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);
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

  useEffect(() => {
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setCurrentUserRoleKey(null);
        return;
      }
      const { data } = await supabase
        .from('users')
        .select('role_id, roles(key)')
        .eq('id', authUser.id)
        .single();
      const roleKey = (data?.roles as { key?: string } | null)?.key ?? null;
      setCurrentUserRoleKey(roleKey);
    })();
  }, [supabase]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
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
      showToast('User berhasil dibuat.', 'success');
    } finally {
      setCreating(false);
    }
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
    setEditingSubmitting(true);
    try {
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
      showToast('User berhasil diperbarui.', 'success');
    } finally {
      setEditingSubmitting(false);
    }
  }

  function openConfirmReset(u: UserRow) {
    setConfirmReset(u);
  }

  async function handleReset(u: UserRow) {
    setError(null);
    setResettingId(u.id);
    try {
      const res = await fetch('/api/admin/users/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; dmSent?: boolean; dmError?: string };
      if (!res.ok) {
        showToast(data.error ?? 'Gagal reset password', 'error');
        setError(data.error ?? 'Gagal reset password');
        return;
      }
      if (u.discord_id && !data.dmSent) {
        showToast(`Password berhasil direset. Tapi DM Discord gagal: ${data.dmError ?? 'unknown'}`, 'error');
      } else {
        showToast('Password berhasil direset.', 'success');
      }
      setConfirmReset(null);
      load();
    } finally {
      setResettingId(null);
    }
  }

  function openConfirmDelete(u: UserRow) {
    setConfirmDelete(u);
  }

  async function handleDelete(u: UserRow) {
    setError(null);
    setDeletingId(u.id);
    try {
      const res = await fetch(`/api/admin/users?id=${u.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Gagal hapus');
        return;
      }
      setConfirmDelete(null);
      load();
      showToast('User berhasil dihapus.', 'success');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <Card title="User Management"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <>
      {toast && (
        <div
          role="alert"
          className={`fixed top-4 right-4 z-100 rounded-xl px-4 py-3 shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-emerald-600 text-white border border-emerald-500/50' : 'bg-red-600 text-white border border-red-500/50'
          }`}
        >
          {toast.message}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
          <p className="mt-2 text-xs text-amber-300/80">
            Jika error timeout/500: jalankan migration fix RLS di Supabase SQL Editor (fix_rls_recursion.sql)
          </p>
        </div>
      )}
    <div className="space-y-6">
      {currentUserRoleKey === 'superadmin' && (
      <Card title="Setup Channel Aktifasi DM">
        <p className="text-xs text-slate-400 mb-3">
          Buat channel khusus di Discord, paste Channel ID di bawah, lalu klik Post. User bisa klik tombol &quot;Aktifkan DM&quot; untuk membuka DM dengan bot agar bisa terima notifikasi reset password.
        </p>
        <p className="text-[11px] text-slate-500 mb-2">
          Channel ID: Developer Mode ON → klik kanan channel → Copy Channel ID. Wajib set Interactions Endpoint URL di Discord Developer Portal → Application → General Information: <code className="text-slate-400">https://bfl-market.vercel.app/api/discord/interactions</code> dan env DISCORD_PUBLIC_KEY.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm min-w-[200px]"
            placeholder="Channel ID (angka panjang)"
            value={dmChannelId}
            onChange={(e) => setDmChannelId(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={dmSetupLoading || !dmChannelId.trim()}
            onClick={async () => {
              setDmSetupLoading(true);
              const res = await fetch('/api/admin/discord/setup-dm-channel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId: dmChannelId.trim() }),
              });
              const data = await res.json().catch(() => ({}));
              setDmSetupLoading(false);
              if (res.ok) {
                showToast('Pesan dengan tombol berhasil dipost ke channel.', 'success');
              } else {
                showToast(data.error ?? 'Gagal post', 'error');
              }
            }}
          >
            {dmSetupLoading ? 'Posting…' : 'Post ke Channel'}
          </Button>
        </div>
      </Card>
      )}
      <Card title="Create User">
        <p className="mb-3 text-xs text-slate-400">Password 6 digit akan di-generate otomatis dan dikirim via Discord DM (wajib isi Discord ID).</p>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-3">
          <input className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required disabled={creating} />
          <input className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required disabled={creating} />
          <select className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed" value={roleId} onChange={(e) => setRoleId(e.target.value)} disabled={creating}>
            <option value="">Role</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed" placeholder="Discord ID (untuk kirim credentials via DM)" value={discordId} onChange={(e) => setDiscordId(e.target.value)} disabled={creating} />
          <Button type="submit" disabled={creating} className="min-w-[100px]">
            {creating ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                Membuat…
              </span>
            ) : (
              'Create'
            )}
          </Button>
        </form>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </Card>
      <Card title="Users">
        <TableToolbar
          searchPlaceholder="Cari nama atau username…"
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          filters={[
            {
              label: 'Role:',
              options: [{ value: '', label: 'Semua' }, ...roles.map((r) => ({ value: r.id, label: r.name }))],
              value: filterRole,
              onChange: (v) => { setFilterRole(v); setPage(1); },
            },
          ]}
          totalCount={filteredUsers.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
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
              {paginatedUsers.map((u) => (
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
                  <td className="p-2">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-bfl-primary/40 bg-bfl-primary/10 px-3 py-1.5 text-xs font-medium text-bfl-primary transition-colors hover:bg-bfl-primary/20 hover:border-bfl-primary/60 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-bfl-primary/10"
                        onClick={() => openEdit(u)}
                        disabled={!!resettingId || !!deletingId}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20 hover:border-amber-500/60 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-500/10"
                        onClick={() => openConfirmReset(u)}
                        disabled={!!resettingId || !!deletingId}
                      >
                        {resettingId === u.id ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                            Mengirim…
                          </>
                        ) : (
                          <>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                            Reset
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 hover:border-red-500/60 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-500/10"
                        onClick={() => openConfirmDelete(u)}
                        disabled={!!resettingId || !!deletingId}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {confirmReset && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !resettingId && setConfirmReset(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 ring-1 ring-amber-500/30">
                <svg className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 id="reset-dialog-title" className="text-lg font-semibold text-slate-50">Reset Password</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Password baru akan di-generate dan dikirim ke user:
                </p>
                <div className="mt-3 rounded-lg bg-slate-800/60 px-4 py-3 ring-1 ring-slate-700/50">
                  <p className="font-medium text-slate-100">{confirmReset.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">@{confirmReset.username}</p>
                </div>
                {confirmReset.discord_id ? (
                  <p className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Password akan dikirim via Discord DM
                  </p>
                ) : (
                  <p className="mt-3 flex items-center gap-2 text-xs text-amber-400">
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    User belum punya Discord ID — DM tidak akan terkirim
                  </p>
                )}
                <div className="mt-6 flex gap-3 justify-end">
                  <Button variant="secondary" onClick={() => setConfirmReset(null)} disabled={!!resettingId}>
                    Batal
                  </Button>
                  <Button onClick={() => handleReset(confirmReset)} disabled={!!resettingId}>
                    {resettingId === confirmReset.id ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                        Mengirim…
                      </span>
                    ) : (
                      'Reset Password'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !deletingId && setConfirmDelete(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <h2 id="delete-dialog-title" className="text-lg font-semibold text-slate-50">Konfirmasi Hapus User</h2>
            <p className="mt-3 text-sm text-slate-300">
              Apakah Anda yakin ingin menghapus user <strong>{confirmDelete.name}</strong> ({confirmDelete.username})? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={!!deletingId}>
                Batal
              </Button>
              <Button
                variant="primary"
                className="bg-red-600 hover:bg-red-700 text-white border-red-500/50"
                onClick={() => handleDelete(confirmDelete)}
                disabled={!!deletingId}
              >
                {deletingId === confirmDelete.id ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                    Menghapus…
                  </span>
                ) : (
                  'Hapus'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { if (!editingSubmitting) setEditing(null); }}>
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
                <Button type="submit" disabled={editingSubmitting} className="min-w-[100px]">
                  {editingSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                      Menyimpan…
                    </span>
                  ) : (
                    'Simpan'
                  )}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={editingSubmitting}>Batal</Button>
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
