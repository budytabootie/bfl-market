'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function ChangePasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Password dan konfirmasi tidak sama');
      return;
    }
    if (password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }
    setLoading(true);
    const { data: { user }, error: authErr } = await supabase.auth.updateUser({ password });
    if (authErr) {
      setError(authErr.message);
      setLoading(false);
      return;
    }
    if (!user?.id) {
      setError('Session tidak valid');
      setLoading(false);
      return;
    }
    const { error: dbErr } = await supabase.from('users').update({ must_change_password: false }).eq('id', user.id);
    if (dbErr) {
      setError(dbErr.message);
      setLoading(false);
      return;
    }
    const { data: perms } = await supabase.rpc('current_user_permissions');
    const permissions = (perms as string[]) ?? [];
    setLoading(false);
    if (permissions.includes('menu:admin')) {
      window.location.href = '/choose-panel';
    } else {
      window.location.href = '/marketplace';
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bfl-bg p-4">
      <Card title="Ganti Password" className="w-full max-w-sm">
        <p className="mb-4 text-sm text-slate-400">Anda harus mengganti password sebelum melanjutkan.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>
          )}
          <div>
            <label className="text-xs text-slate-400">Password baru</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50"
              placeholder="Min. 6 karakter"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Konfirmasi password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50"
              placeholder="Ulangi password"
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Menyimpan…' : 'Simpan & Lanjutkan'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
