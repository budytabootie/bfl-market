'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Profile = { id: string; name: string; username: string };

export default function SettingsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  const [username, setUsername] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;
      const { data } = await supabase.from('users').select('id, name, username').eq('id', user.id).single();
      if (data) {
        setProfile(data as Profile);
        setName((data as Profile).name);
        setUsername((data as Profile).username);
      }
      setLoading(false);
    })();
  }, [supabase]);

  async function handleChangeName(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setNameError(null);
    setNameSuccess(false);
    setNameLoading(true);
    const { error } = await supabase.from('users').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('id', profile.id);
    setNameLoading(false);
    if (error) {
      setNameError(error.message);
      return;
    }
    setNameSuccess(true);
    setProfile((p) => (p ? { ...p, name: name.trim() } : null));
    setTimeout(() => setNameSuccess(false), 3000);
  }

  async function handleChangeUsername(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const newUsername = username.trim().toLowerCase();
    if (!newUsername) {
      setUsernameError('Username tidak boleh kosong');
      return;
    }
    setUsernameError(null);
    setUsernameSuccess(false);
    setUsernameLoading(true);
    const email = `${newUsername}@bfl.local`;
    const { error: authErr } = await supabase.auth.updateUser({ email });
    if (authErr) {
      setUsernameLoading(false);
      setUsernameError(authErr.message);
      return;
    }
    const { error: dbErr } = await supabase.from('users').update({ username: newUsername, updated_at: new Date().toISOString() }).eq('id', profile.id);
    setUsernameLoading(false);
    if (dbErr) {
      setUsernameError(dbErr.message);
      return;
    }
    setUsernameSuccess(true);
    setProfile((p) => (p ? { ...p, username: newUsername } : null));
    setUsername(newUsername);
    setTimeout(() => setUsernameSuccess(false), 3000);
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setPasswordError('Password baru dan konfirmasi tidak sama');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password minimal 6 karakter');
      return;
    }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setPasswordSuccess(true);
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordSuccess(false), 3000);
  }

  if (loading) return <Card title="Settings"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800/80 bg-linear-to-br from-bfl-card/60 to-slate-950/60 p-5">
        <h1 className="text-xl font-semibold text-slate-50">Pengaturan Akun</h1>
        <p className="mt-1 text-sm text-slate-400">Ubah nama, username, atau password Anda.</p>
      </div>

      <Card title="Ubah Nama">
        <form onSubmit={handleChangeName} className="space-y-3">
          {nameError && <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{nameError}</div>}
          {nameSuccess && <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Nama berhasil diubah.</div>}
          <div>
            <label className="form-label">Nama</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <Button type="submit" disabled={nameLoading}>{nameLoading ? 'Menyimpan…' : 'Simpan Nama'}</Button>
        </form>
      </Card>

      <Card title="Ubah Username">
        <form onSubmit={handleChangeUsername} className="space-y-3">
          {usernameError && <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{usernameError}</div>}
          {usernameSuccess && <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Username berhasil diubah. Gunakan username baru untuk login berikutnya.</div>}
          <div>
            <label className="form-label">Username (untuk login)</label>
            <Input className="lowercase" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} required />
          </div>
          <Button type="submit" disabled={usernameLoading}>{usernameLoading ? 'Menyimpan…' : 'Simpan Username'}</Button>
        </form>
      </Card>

      <Card title="Ubah Password">
        <form onSubmit={handleChangePassword} className="space-y-3">
          {passwordError && <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{passwordError}</div>}
          {passwordSuccess && <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Password berhasil diubah.</div>}
          <div>
            <label className="form-label">Password baru</label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 karakter" required minLength={6} />
          </div>
          <div>
            <label className="form-label">Konfirmasi password baru</label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ulangi password" required minLength={6} />
          </div>
          <Button type="submit" disabled={passwordLoading}>{passwordLoading ? 'Menyimpan…' : 'Simpan Password'}</Button>
        </form>
      </Card>
    </div>
  );
}
