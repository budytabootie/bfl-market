'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleLogout() {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
    router.push('/login');
    router.refresh();
  }

  return (
    <Button variant="ghost" className="text-xs" onClick={handleLogout} disabled={loading}>
      {loading ? '…' : 'Logout'}
    </Button>
  );
}
