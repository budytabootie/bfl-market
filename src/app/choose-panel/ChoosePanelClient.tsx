'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type Props = { initialCanAdmin: boolean | null };

export function ChoosePanelClient({ initialCanAdmin }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [canAdmin, setCanAdmin] = useState<boolean | null>(initialCanAdmin);
  const [loading, setLoading] = useState(initialCanAdmin === null);

  useEffect(() => {
    if (initialCanAdmin !== null) return;
    (async () => {
      const { data: perms } = await supabase.rpc('current_user_permissions');
      const p = (perms as string[]) ?? [];
      setCanAdmin(p.includes('menu:admin'));
      setLoading(false);
    })();
  }, [supabase, initialCanAdmin]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bfl-bg">
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  if (!canAdmin) {
    router.replace('/marketplace');
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bfl-bg p-4">
      <Card title="Pilih Panel" className="w-full max-w-md">
        <p className="mb-4 text-sm text-slate-400">Anda memiliki akses Admin. Pilih panel:</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button className="w-full sm:w-auto" onClick={() => { window.location.href = '/admin'; }}>
            Masuk Admin Panel
          </Button>
          <Button variant="ghost" className="w-full sm:w-auto" onClick={() => { window.location.href = '/marketplace'; }}>
            Masuk User Panel
          </Button>
        </div>
      </Card>
    </div>
  );
}
