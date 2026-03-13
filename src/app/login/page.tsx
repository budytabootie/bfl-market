'use client';

import { useState, useRef, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usernameToBflEmail, normalizeLoginInput, normalizeUsernameForLogin } from '@/lib/username-email';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/*
 * Kemungkinan perilaku user dan penanganan:
 * - Copy-paste username/password: bisa bawa spasi unicode (\u00A0), newline, zero-width char → normalizeLoginInput()
 * - Autocomplete / password manager: kadang isi salah field atau ada karakter tambahan → normalize + trim
 * - Double-click / submit 2x cepat: hanya satu request yang diproses → submittingRef
 * - Ketik manual dengan spasi di ujung: trim + normalize
 * - Network flakiness: Supabase return 400/5xx; kita tampilkan err.message, tidak retry otomatis
 */

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';
  const reason = searchParams.get('reason');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const supabase = createClient();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setLoading(true);
    setSuccess(false);
    const normalizedUsername = normalizeUsernameForLogin(username);
    const normalizedPassword = normalizeLoginInput(password);
    if (!normalizedUsername || !normalizedPassword) {
      setError('Username dan password wajib diisi.');
      setLoading(false);
      submittingRef.current = false;
      return;
    }
    const email = usernameToBflEmail(normalizedUsername);
    const { data: signInData, error: err } = await supabase.auth.signInWithPassword({ email, password: normalizedPassword });
    if (err) {
      submittingRef.current = false;
      const isInvalidCreds = err.message?.toLowerCase().includes('invalid login credentials');
      setError(
        isInvalidCreds
          ? `Kredensial ditolak. Email yang dicoba: ${email} — pastikan user ini ada di Supabase (Dashboard → Authentication → Users) dan password benar. Lupa password? Minta admin reset.`
          : err.message
      );
      setLoading(false);
      return;
    }
    setSuccess(true);
    const { data: profile } = await supabase.from('users').select('must_change_password').eq('id', signInData.user!.id).single();
    if ((profile as { must_change_password?: boolean })?.must_change_password) {
      setLoading(false);
      submittingRef.current = false;
      window.location.href = '/change-password';
      return;
    }
    const { data: perms } = await supabase.rpc('current_user_permissions');
    const permissions = (perms as string[]) ?? [];
    setLoading(false);
    submittingRef.current = false;
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
                Pesan &quot;400 (Bad Request)&quot; di console browser itu normal saat login gagal — artinya Supabase menolak username/password. Cek di Dashboard atau minta admin reset password.
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
