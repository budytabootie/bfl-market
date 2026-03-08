'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

type Order = {
  id: string;
  created_at: string;
  status: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  catalog: { name: string } | null;
  quantity: number;
  status: string;
  subtotal: number;
  is_po: boolean;
  ready_for_receive_at: string | null;
  received_at: string | null;
};

export default function MyOrdersPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('users').select('id').eq('id', user.id).single();
    if (!profile) return;
    const { data: ord } = await supabase.from('orders').select('id, created_at, status').eq('user_id', profile.id).order('created_at', { ascending: false });
    setOrders((ord ?? []) as Order[]);
    const ids = (ord ?? []).map((o) => o.id);
    if (ids.length > 0) {
      const { data: it } = await supabase.from('order_items').select('id, order_id, catalog(name), quantity, status, subtotal, is_po, ready_for_receive_at, received_at').in('order_id', ids);
      setItems((it ?? []) as unknown as OrderItem[]);
    } else setItems([]);
  }

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, []);

  const totalByOrder = (orderId: string) => {
    return items
      .filter((i) => i.order_id === orderId && (i.status === 'approved' || i.status === 'processed'))
      .reduce((s, i) => s + i.subtotal, 0);
  };

  if (loading) return <Card title="My Orders"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800/80 bg-linear-to-br from-bfl-card/60 to-slate-950/60 p-5">
        <h1 className="text-xl font-semibold text-slate-50">My Orders</h1>
        <p className="mt-1 text-sm text-slate-400">Riwayat order Anda. Status akan diperbarui oleh admin setelah diproses.</p>
      </div>
      <Card title="My Orders">
        {orders.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400 mb-3">Belum ada order.</p>
            <Link href="/marketplace" className="text-bfl-primary hover:underline text-sm font-medium">Mulai belanja di Marketplace →</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <div key={o.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex justify-between text-sm">
                  <span>{o.id.slice(0, 8)}… • {new Date(o.created_at).toLocaleString()}</span>
                  <span className={`capitalize ${o.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'}`}>{o.status}</span>
                </div>
                <div className="mt-2 text-xs">
                  {items.filter((i) => i.order_id === o.id).map((i) => (
                    <div key={i.id} className="flex justify-between items-center flex-wrap gap-1">
                      <span>
                        {(i.catalog as { name?: string })?.name ?? '-'} x{i.quantity} ({i.status})
                        {i.is_po && <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">PO</span>}
                        {i.is_po && i.received_at && <span className="ml-1 text-emerald-400">✓ Diterima</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        {i.is_po && i.ready_for_receive_at && !i.received_at && (
                          <Button
                            type="button"
                            variant="primary"
                            className="py-1! px-2! min-h-0! text-[10px]"
                            onClick={async () => {
                              await supabase.from('order_items').update({ received_at: new Date().toISOString() }).eq('id', i.id);
                              await load();
                            }}
                          >
                            Konfirmasi Diterima
                          </Button>
                        )}
                        <span>{i.subtotal.toLocaleString('id-ID')}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-sm font-semibold text-emerald-400">
                  Total (approved): {totalByOrder(o.id).toLocaleString('id-ID')}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
