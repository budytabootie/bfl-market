'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TableToolbar } from '@/components/ui/TableToolbar';

type Order = {
  id: string;
  created_at: string;
  status: string;
  user_id: string;
  users: { username: string } | null;
};

type OrderItem = {
  id: string;
  order_id: string;
  catalog_id: string;
  quantity: number;
  status: string;
  is_po: boolean;
  catalog: { name: string } | null;
};

export default function AdminOrdersPage() {
  const supabase = createClient();
  const [pending, setPending] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPo, setFilterPo] = useState<'all' | 'po' | 'regular'>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  const filteredPending = useMemo(() => {
    let r = pending;
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((o) => ((o.users as { username?: string })?.username ?? '').toLowerCase().includes(q));
    if (filterPo === 'po') r = r.filter((o) => items.some((i) => i.order_id === o.id && i.is_po));
    if (filterPo === 'regular') r = r.filter((o) => !items.some((i) => i.order_id === o.id && i.is_po));
    return r;
  }, [pending, search, filterPo, items]);

  const paginatedPending = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredPending.slice(from, from + PAGE_SIZE);
  }, [filteredPending, page]);

  async function load() {
    const { data: ord } = await supabase
      .from('orders')
      .select('id, created_at, status, user_id, users(username)')
      .eq('status', 'pending')
      .order('created_at');
    setPending((ord ?? []) as unknown as Order[]);

    const orderIds = (ord ?? []).map((o) => o.id);
    if (orderIds.length > 0) {
      const { data: it } = await supabase
        .from('order_items')
        .select('id, order_id, catalog_id, quantity, status, is_po, catalog(name)')
        .in('order_id', orderIds);
      setItems((it ?? []) as unknown as OrderItem[]);
    } else {
      setItems([]);
    }
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function approveItem(id: string) {
    await supabase.from('order_items').update({ status: 'approved' }).eq('id', id);
    load();
  }

  async function rejectItem(id: string) {
    await supabase.from('order_items').update({ status: 'rejected' }).eq('id', id);
    load();
  }

  async function processOrder(orderId: string) {
    await supabase.rpc('process_order', { p_order_id: orderId });
    load();
  }

  if (loading) return <Card title="Pending Orders"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <div className="space-y-6">
      <Card title="Pending Orders">
        <TableToolbar
          searchPlaceholder="Cari username…"
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          filters={[
            {
              label: 'Tipe:',
              options: [
                { value: 'all', label: 'Semua' },
                { value: 'po', label: 'Hanya PO' },
                { value: 'regular', label: 'Hanya Regular' },
              ],
              value: filterPo,
              onChange: (v) => { setFilterPo(v as 'all' | 'po' | 'regular'); setPage(1); },
            },
          ]}
          totalCount={filteredPending.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
        <div className="space-y-4">
          {paginatedPending.map((o) => {
            const orderItems = items.filter((i) => i.order_id === o.id);
            const hasApproved = orderItems.some((i) => i.status === 'approved');
            return (
              <div key={o.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex justify-between text-sm">
                  <span>Order {o.id.slice(0, 8)}… • {(o.users as { username?: string })?.username ?? '-'} • {new Date(o.created_at).toLocaleString()}</span>
                  {hasApproved && (
                    <Button className="text-xs" onClick={() => processOrder(o.id)}>Process Order</Button>
                  )}
                </div>
                <div className="mt-2 overflow-x-auto text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="p-1 text-left">Item</th>
                        <th className="p-1 text-right">Qty</th>
                        <th className="p-1 text-center">Tipe</th>
                        <th className="p-1 text-center">Status</th>
                        <th className="p-1">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map((i) => (
                        <tr key={i.id} className="border-t border-slate-800">
                          <td className="p-1">{(i.catalog as { name?: string })?.name ?? '-'}</td>
                          <td className="p-1 text-right">{i.quantity}</td>
                          <td className="p-1 text-center">
                            {i.is_po ? (
                              <span className="rounded px-2 py-0.5 text-[11px] bg-amber-500/20 text-amber-300">PO</span>
                            ) : (
                              <span className="text-slate-500">Regular</span>
                            )}
                          </td>
                          <td className="p-1 text-center">
                            <span className={`rounded px-2 py-0.5 text-[11px] ${
                              i.status === 'approved' ? 'bg-emerald-500/20' :
                              i.status === 'rejected' ? 'bg-red-500/20' : 'bg-slate-700'
                            }`}>{i.status}</span>
                          </td>
                          <td className="p-1">
                            {i.status === 'pending' && (
                              <>
                                <button type="button" className="text-emerald-400 hover:underline mr-2" onClick={() => approveItem(i.id)}>Approve</button>
                                <button type="button" className="text-red-400 hover:underline" onClick={() => rejectItem(i.id)}>Reject</button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
