'use client';

import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usernameToBflEmail } from '@/lib/username-email';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';
  const reason = searchParams.get('reason');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setSuccess(false);
    const normalizedUsername = String(username).trim().toLowerCase();
    const normalizedPassword = String(password).trim();
    if (!normalizedUsername || !normalizedPassword) {
      setError('Username dan password wajib diisi.');
      setLoading(false);
      return;
    }
    const email = usernameToBflEmail(normalizedUsername);
    // Supabase auth returns 400 (token?grant_type=password) when credentials invalid; console "Failed to load resource" is normal for that.
    const { data: signInData, error: err } = await supabase.auth.signInWithPassword({ email, password: normalizedPassword });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setSuccess(true);
    const { data: profile } = await supabase.from('users').select('must_change_password').eq('id', signInData.user!.id).single();
    if ((profile as { must_change_password?: boolean })?.must_change_password) {
      setLoading(false);
      window.location.href = '/change-password';
      return;
    }
    const { data: perms } = await supabase.rpc('current_user_permissions');
    const permissions = (perms as string[]) ?? [];
    setLoading(false);
    if (permissions.includes('menu:admin')) {
      window.location.href = '/choose-panel';
    } else {
      window.location.href = redirect === '/' ? '/marketplace' : redirect;
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bfl-bg p-4 safe-area-inset">
      <Card title="Login" className="w-full max-w-sm mx-auto">
        {reason === 'session_expired' && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 mb-4">
            Session habis (24 jam). Silakan login lagi.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              <p>{error}</p>
              <p className="mt-1.5 text-red-300/90">
                Cek username (tanpa spasi di awal/akhir) dan password. Username harus persis seperti saat dibuat. Jika lupa password, minta admin untuk reset.
              </p>
            </div>
          )}
          <div>
            <label className="text-xs text-slate-400">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50"
              placeholder="superadmin"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || success}>
            {loading ? 'Signing in…' : success ? 'Berhasil! Mengalihkan…' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
