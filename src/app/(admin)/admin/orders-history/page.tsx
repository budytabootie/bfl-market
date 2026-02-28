'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { TableToolbar } from '@/components/ui/TableToolbar';
import Link from 'next/link';

type Order = {
  id: string;
  created_at: string;
  status: string;
  completed_at: string | null;
  approved_by: string | null;
  user_id: string;
  users: { username: string; name: string } | null;
  approver: { username: string; name: string } | null;
};

type OrderItem = {
  id: string;
  order_id: string;
  catalog_id: string;
  quantity: number;
  price_each: number;
  subtotal: number;
  status: string;
  catalog: { name: string } | null;
};

export default function AdminOrdersHistoryPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filteredOrders = useMemo(() => {
    let r = orders;
    const q = search.trim().toLowerCase();
    if (q) {
      r = r.filter((o) => {
        const u = (o.users as { username?: string; name?: string }) ?? {};
        const username = (u.username ?? '').toLowerCase();
        const name = (u.name ?? '').toLowerCase();
        return username.includes(q) || name.includes(q);
      });
    }
    if (filterStatus) r = r.filter((o) => o.status === filterStatus);
    return r;
  }, [orders, search, filterStatus]);

  const paginatedOrders = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredOrders.slice(from, from + PAGE_SIZE);
  }, [filteredOrders, page]);

  useEffect(() => {
    void (async () => {
      try {
        const { data: ord } = await supabase
          .from('orders')
          .select(`
            id, created_at, status, completed_at, approved_by, user_id,
            users(username, name),
            approver:users!approved_by(username, name)
          `)
          .order('created_at', { ascending: false });
        setOrders((ord ?? []) as unknown as Order[]);

        const orderIds = (ord ?? []).map((o) => o.id);
        if (orderIds.length > 0) {
          const { data: it } = await supabase
            .from('order_items')
            .select('id, order_id, catalog_id, quantity, price_each, subtotal, status, catalog(name)')
            .in('order_id', orderIds);
          setItems((it ?? []) as unknown as OrderItem[]);
        } else {
          setItems([]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const itemsByOrder = (orderId: string) =>
    items.filter((i) => i.order_id === orderId);

  const totalApprovedByOrder = (orderId: string) =>
    items
      .filter((i) => i.order_id === orderId && i.status === 'approved')
      .reduce((s, i) => s + i.subtotal, 0);

  if (loading)
    return (
      <Card title="Orders History">
        <p className="text-slate-400">Loading…</p>
      </Card>
    );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5">
        <h1 className="text-xl font-semibold text-slate-50">Orders History</h1>
        <p className="mt-1 text-sm text-slate-400">
          Riwayat semua order: kapan dibeli, siapa yang order, item (approved &
          rejected), total tagihan approved, dan siapa yang melakukan approve.
        </p>
      </div>
      <Card title="Semua Order">
        <TableToolbar
          searchPlaceholder="Cari username pembeli…"
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          filters={[
            {
              label: 'Status:',
              options: [
                { value: '', label: 'Semua' },
                { value: 'pending', label: 'Pending' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ],
              value: filterStatus,
              onChange: (v) => { setFilterStatus(v); setPage(1); },
            },
          ]}
          totalCount={filteredOrders.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
        {filteredOrders.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-slate-400">Belum ada order.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedOrders.map((o) => {
              const orderItems = itemsByOrder(o.id);
              const totalApproved = totalApprovedByOrder(o.id);
              const buyer = (o.users as { username?: string; name?: string }) ?? {};
              const approverData = (o.approver as { username?: string; name?: string }) ?? null;
              return (
                <div
                  key={o.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="font-mono text-slate-500">
                      {o.id.slice(0, 8)}…
                    </span>
                    <span>
                      {new Date(o.created_at).toLocaleString('id-ID', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                    <span className="text-slate-300">
                      Order oleh: <strong>{buyer.username ?? buyer.name ?? '-'}</strong>
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs capitalize ${
                        o.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : o.status === 'cancelled'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>

                  <div className="mt-3 overflow-x-auto text-xs">
                    <table className="w-full">
                      <thead>
                        <tr className="text-slate-400">
                          <th className="p-2 text-left">Item</th>
                          <th className="p-2 text-right">Qty</th>
                          <th className="p-2 text-right">Harga</th>
                          <th className="p-2 text-right">Subtotal</th>
                          <th className="p-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems.map((i) => (
                          <tr
                            key={i.id}
                            className="border-t border-slate-800"
                          >
                            <td className="p-2">
                              {(i.catalog as { name?: string })?.name ?? '-'}
                            </td>
                            <td className="p-2 text-right">{i.quantity}</td>
                            <td className="p-2 text-right">
                              {Number(i.price_each).toLocaleString('id-ID')}
                            </td>
                            <td className="p-2 text-right">
                              {Number(i.subtotal).toLocaleString('id-ID')}
                            </td>
                            <td className="p-2 text-center">
                              <span
                                className={`inline-block rounded px-2 py-0.5 capitalize ${
                                  i.status === 'approved'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : i.status === 'rejected'
                                      ? 'bg-red-500/20 text-red-400'
                                      : i.status === 'processed'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'bg-slate-600 text-slate-300'
                                }`}
                              >
                                {i.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-slate-800 pt-3 text-sm">
                    <span className="font-semibold text-emerald-400">
                      Total approved: Rp {totalApproved.toLocaleString('id-ID')}
                    </span>
                    {approverData && (approverData.username || approverData.name) ? (
                      <span className="text-slate-400">
                        Approved oleh:{' '}
                        <span className="text-slate-200">
                          {approverData.username ?? approverData.name}
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-500">Belum ada approver</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <p className="text-center text-sm text-slate-500">
        <Link href="/admin/orders" className="text-bfl-primary hover:underline">
          ← Ke Pending Orders (approve/reject)
        </Link>
      </p>
    </div>
  );
}
