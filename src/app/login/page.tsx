'use client';

import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';
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
    const email = `${username.trim().toLowerCase()}@bfl.local`;
    const { data: signInData, error: err } = await supabase.auth.signInWithPassword({ email, password });
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
    <div className="flex min-h-screen items-center justify-center bg-bfl-bg p-4">
      <Card title="Login" className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>
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
