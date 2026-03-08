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
  is_po: boolean;
  catalog: { name: string } | null;
};

export default function AdminOrdersHistoryPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterApprover, setFilterApprover] = useState('');
  const [pageRegular, setPageRegular] = useState(1);
  const [pagePo, setPagePo] = useState(1);
  const PAGE_SIZE = 10;

  const approverOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [{ value: '', label: 'Semua' }];
    orders.forEach((o) => {
      const a = o.approver as { username?: string; name?: string } | null;
      const key = a && (a.username || a.name) ? (a.username ?? a.name) : '__none__';
      if (seen.has(key)) return;
      seen.add(key);
      opts.push({ value: key, label: key === '__none__' ? 'Belum ada approver' : key });
    });
    return opts;
  }, [orders]);

  const filterBySearch = (r: Order[]) => {
    const q = search.trim().toLowerCase();
    if (!q) return r;
    return r.filter((o) => {
      const u = (o.users as { username?: string; name?: string }) ?? {};
      const username = (u.username ?? '').toLowerCase();
      const name = (u.name ?? '').toLowerCase();
      return username.includes(q) || name.includes(q);
    });
  };

  const filterByApprover = (r: Order[]) => {
    if (!filterApprover) return r;
    if (filterApprover === '__none__') return r.filter((o) => !o.approved_by);
    return r.filter((o) => {
      const a = o.approver as { username?: string; name?: string } | null;
      return a && ((a.username ?? a.name) === filterApprover);
    });
  };

  const regularOrders = useMemo(() => {
    let r = orders.filter((o) => !items.some((i) => i.order_id === o.id && i.is_po));
    if (filterStatus) r = r.filter((o) => o.status === filterStatus);
    r = filterByApprover(r);
    return filterBySearch(r);
  }, [orders, search, filterStatus, filterApprover, items]);

  const poOrders = useMemo(() => {
    let r = orders.filter((o) => items.some((i) => i.order_id === o.id && i.is_po));
    if (filterStatus) r = r.filter((o) => o.status === filterStatus);
    r = filterByApprover(r);
    return filterBySearch(r);
  }, [orders, search, filterStatus, filterApprover, items]);

  const paginatedRegular = useMemo(() => {
    const from = (pageRegular - 1) * PAGE_SIZE;
    return regularOrders.slice(from, from + PAGE_SIZE);
  }, [regularOrders, pageRegular]);

  const paginatedPo = useMemo(() => {
    const from = (pagePo - 1) * PAGE_SIZE;
    return poOrders.slice(from, from + PAGE_SIZE);
  }, [poOrders, pagePo]);

  /** Group orders by transaction date (created_at, local date) for clearer separation and per-day totals */
  function groupOrdersByDate(orderList: Order[]) {
    const map = new Map<string, { dateKey: string; dateLabel: string; orders: Order[] }>();
    for (const o of orderList) {
      const d = new Date(o.created_at);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${day}`;
      const dateLabel = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      if (!map.has(dateKey)) map.set(dateKey, { dateKey, dateLabel, orders: [] });
      map.get(dateKey)!.orders.push(o);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, v]) => v);
  }

  useEffect(() => {
    void (async () => {
      setError(null);
      try {
        const { data: ord, error: ordErr } = await supabase
          .from('orders')
          .select(`
            id, created_at, status, completed_at, approved_by, user_id,
            users!user_id(username, name),
            approver:users!approved_by(username, name)
          `)
          .order('created_at', { ascending: false });
        if (ordErr) {
          setError(`Gagal load orders: ${ordErr.message}`);
          setOrders([]);
          setItems([]);
          setLoading(false);
          return;
        }
        setOrders((ord ?? []) as unknown as Order[]);

        const orderIds = (ord ?? []).map((o) => o.id);
        if (orderIds.length > 0) {
          const { data: it, error: itErr } = await supabase
            .from('order_items')
            .select('id, order_id, catalog_id, quantity, price_each, subtotal, status, is_po, catalog(name)')
            .in('order_id', orderIds);
          if (itErr) setError((prev) => (prev ? `${prev}; ` : '') + `Order items: ${itErr.message}`);
          setItems((it ?? []) as unknown as OrderItem[]);
        } else {
          setItems([]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
        setOrders([]);
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const itemsByOrder = (orderId: string) =>
    items.filter((i) => i.order_id === orderId);

  const totalApprovedByOrder = (orderId: string) =>
    items
      .filter((i) => i.order_id === orderId && (i.status === 'approved' || i.status === 'processed'))
      .reduce((s, i) => s + i.subtotal, 0);

  const totalApprovedForOrders = (orderList: Order[]) =>
    orderList.reduce((sum, o) => sum + totalApprovedByOrder(o.id), 0);

  if (loading)
    return (
      <Card title="Orders History">
        <p className="text-slate-400">Loading…</p>
      </Card>
    );

  function renderOrderCard(o: Order) {
    const orderItems = itemsByOrder(o.id);
    const totalApproved = totalApprovedByOrder(o.id);
    const buyer = (o.users as { username?: string; name?: string }) ?? {};
    const approverData = (o.approver as { username?: string; name?: string }) ?? null;
    return (
      <div key={o.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid grid-cols-1 gap-1 text-sm border-b border-slate-800 pb-3">
          <div><span className="text-slate-500">ID Transaksi:</span> <span className="font-mono text-slate-300">{o.id.slice(0, 8)}…</span></div>
          <div><span className="text-slate-500">Order oleh:</span> <span className="text-slate-200 font-medium">{buyer.username ?? buyer.name ?? '-'}</span></div>
          <div><span className="text-slate-500">Tanggal:</span> <span className="text-slate-300">{new Date(o.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500">Status:</span>
            <span className={`rounded px-2 py-0.5 text-xs capitalize ${o.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : o.status === 'cancelled' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {o.status}
            </span>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto text-xs">
          <table className="w-full min-w-[520px] border-collapse table-fixed">
            <colgroup>
              <col style={{ width: '24%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="p-2 text-left">Item</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-center">Tipe</th>
                <th className="p-2 text-right">Harga</th>
                <th className="p-2 text-right">Subtotal</th>
                <th className="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {orderItems.map((i) => (
                <tr key={i.id} className="border-b border-slate-800/80">
                  <td className="p-2 truncate" title={(i.catalog as { name?: string })?.name ?? '-'}>{(i.catalog as { name?: string })?.name ?? '-'}</td>
                  <td className="p-2 text-right">{i.quantity}</td>
                  <td className="p-2 text-center">
                    {i.is_po ? <span className="rounded px-2 py-0.5 text-[11px] bg-amber-500/20 text-amber-300">PO</span> : <span className="text-slate-500">Regular</span>}
                  </td>
                  <td className="p-2 text-right">{Number(i.price_each).toLocaleString('id-ID')}</td>
                  <td className="p-2 text-right">{Number(i.subtotal).toLocaleString('id-ID')}</td>
                  <td className="p-2 text-center">
                    <span className={`inline-block rounded px-2 py-0.5 capitalize ${i.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : i.status === 'rejected' ? 'bg-red-500/20 text-red-400' : i.status === 'processed' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-600 text-slate-300'}`}>
                      {i.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-slate-800 pt-3 text-sm">
          <span className="font-semibold text-emerald-400">Total approved: Rp {totalApproved.toLocaleString('id-ID')}</span>
          {approverData && (approverData.username || approverData.name) ? (
            <span className="text-slate-400">Approved oleh: <span className="text-slate-200">{approverData.username ?? approverData.name}</span></span>
          ) : (
            <span className="text-slate-500">Belum ada approver</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
          <p className="mt-1 text-xs text-amber-300/80">Pastikan login sebagai Super Admin atau Treasurer. Cek RLS di Supabase.</p>
        </div>
      )}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5">
        <h1 className="text-xl font-semibold text-slate-50">Orders History</h1>
        <p className="mt-1 text-sm text-slate-400">
          Riwayat order Reguler dan PO. Filter status berlaku untuk kedua bagian.
        </p>
      </div>

      <Card title="Order Reguler" className="border-slate-700/80">
        <TableToolbar
          searchPlaceholder="Cari username pembeli…"
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPageRegular(1); setPagePo(1); }}
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
              onChange: (v) => { setFilterStatus(v); setPageRegular(1); setPagePo(1); },
            },
            {
              label: 'Approver:',
              options: approverOptions,
              value: filterApprover,
              onChange: (v) => { setFilterApprover(v); setPageRegular(1); setPagePo(1); },
            },
          ]}
          totalCount={regularOrders.length}
          page={pageRegular}
          pageSize={PAGE_SIZE}
          onPageChange={setPageRegular}
        />
        {regularOrders.length === 0 ? (
          <div className="py-8 text-center"><p className="text-slate-400">Belum ada order reguler.</p></div>
        ) : (
          <div className="space-y-8">
            {groupOrdersByDate(paginatedRegular).map(({ dateKey, dateLabel, orders: dayOrders }) => (
              <div key={dateKey} className="rounded-xl border border-slate-700/80 bg-slate-900/30 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700/80 bg-slate-800/50 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-200">Transaksi {dateLabel}</h3>
                  <span className="text-sm font-medium text-emerald-400">
                    Total approved hari ini: Rp {totalApprovedForOrders(dayOrders).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="p-4 space-y-4">
                  {dayOrders.map((o) => renderOrderCard(o))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Order PO" className="border-amber-500/30 bg-amber-950/10">
        <TableToolbar
          searchPlaceholder="Cari username pembeli…"
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPageRegular(1); setPagePo(1); }}
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
              onChange: (v) => { setFilterStatus(v); setPageRegular(1); setPagePo(1); },
            },
            {
              label: 'Approver:',
              options: approverOptions,
              value: filterApprover,
              onChange: (v) => { setFilterApprover(v); setPageRegular(1); setPagePo(1); },
            },
          ]}
          totalCount={poOrders.length}
          page={pagePo}
          pageSize={PAGE_SIZE}
          onPageChange={setPagePo}
        />
        {poOrders.length === 0 ? (
          <div className="py-8 text-center"><p className="text-slate-400">Belum ada order PO.</p></div>
        ) : (
          <div className="space-y-8">
            {groupOrdersByDate(paginatedPo).map(({ dateKey, dateLabel, orders: dayOrders }) => (
              <div key={dateKey} className="rounded-xl border border-amber-500/20 bg-amber-950/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-amber-500/20 bg-amber-950/20 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-200">Transaksi {dateLabel}</h3>
                  <span className="text-sm font-medium text-amber-400">
                    Total approved hari ini: Rp {totalApprovedForOrders(dayOrders).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="p-4 space-y-4">
                  {dayOrders.map((o) => renderOrderCard(o))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="text-center text-sm text-slate-500">
        <Link href="/admin/orders" className="text-bfl-primary hover:underline">← Ke Pending Orders</Link>
      </p>
    </div>
  );
}
