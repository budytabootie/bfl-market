'use client';

// src/components/auth/LoginForm.tsx
import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const redirectedFrom = searchParams.get('redirectedFrom') ?? '/';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const trimmedUsername = username.trim().toLowerCase();

      if (!trimmedUsername || !password) {
        setError('Username dan password wajib diisi.');
        setLoading(false);
        return;
      }

      // Konversi username menjadi email internal Supabase
      const email = `${trimmedUsername}@bfl.local`;

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      router.push(redirectedFrom || '/');
      router.refresh();
    } catch (err) {
      setError('Terjadi kesalahan saat login. Coba lagi.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md">
        <Card title="Sign in to BFL-MARKET">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Username
              </label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none focus:border-bfl-primary focus:ring-2 focus:ring-bfl-primary/50"
                placeholder="contoh: superadmin"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none focus:border-bfl-primary focus:ring-2 focus:ring-bfl-primary/50"
                placeholder="********"
              />
            </div>

            <Button
              type="submit"
              className="w-full justify-center"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>

            <p className="mt-1 text-[11px] text-slate-500">
              Gunakan username yang dipetakan ke akun Supabase dengan pola
              <span className="font-mono text-slate-300">
                {' '}
                username@bfl.local
              </span>
              .
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}

