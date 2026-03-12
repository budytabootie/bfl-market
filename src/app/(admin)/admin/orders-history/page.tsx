'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TableToolbar } from '@/components/ui/TableToolbar';
import { formatDateLabelWIB, formatDateShortWIB, formatDateTimeWIB, getDateKeyWIB } from '@/lib/date-wib';
import Link from 'next/link';

type Order = {
  id: string;
  created_at: string;
  status: string;
  completed_at: string | null;
  approved_by: string | null;
  user_id: string;
  paid_at: string | null;
  paid_amount: number | null;
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
  ready_for_receive_at: string | null;
  received_at: string | null;
  catalog: { name: string; category?: string } | null;
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
  const [poTab, setPoTab] = useState<'bayar' | 'diterima' | 'selesai'>('bayar');
  const [payModalOrderId, setPayModalOrderId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [snModalItem, setSnModalItem] = useState<{ orderId: string; itemId: string; catalogId: string; itemName: string; userId: string } | null>(null);
  const [snInput, setSnInput] = useState('');
  const [snLoading, setSnLoading] = useState(false);
  const [orderItemWeapons, setOrderItemWeapons] = useState<{ order_item_id: string }[]>([]);
  const [treasuryUsers, setTreasuryUsers] = useState<{ username: string; name: string }[]>([]);
  const [orderTypeTab, setOrderTypeTab] = useState<'reguler' | 'po'>('reguler');
  const PAGE_SIZE = 10;

  /** Approver filter: gabungan dari approved_by (orders) + daftar Treasury */
  const approverOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [{ value: '', label: 'Semua' }];
    orders.forEach((o) => {
      const a = o.approver as { username?: string; name?: string } | null;
      const key: string = a && (a.username || a.name) ? (a.username ?? a.name) ?? '__none__' : '__none__';
      if (seen.has(key)) return;
      seen.add(key);
      opts.push({ value: key, label: key === '__none__' ? 'Belum ada approver' : key });
    });
    treasuryUsers.forEach((u) => {
      const key = (u.username || u.name) || '';
      if (!key || seen.has(key)) return;
      seen.add(key);
      opts.push({ value: key, label: u.username ?? u.name });
    });
    const rest = opts.slice(1).sort((a, b) => (a.label === 'Belum ada approver' ? -1 : b.label === 'Belum ada approver' ? 1 : a.label.localeCompare(b.label)));
    return [opts[0]!, ...rest];
  }, [orders, treasuryUsers]);

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

  const orderTotal = (orderId: string) =>
    items.filter((i) => i.order_id === orderId).reduce((s, i) => s + Number(i.subtotal), 0);

  /** Total hanya item PO (untuk tab Order PO: bayar/sisa hanya hitung bagian PO) */
  const orderTotalPo = (orderId: string) =>
    items.filter((i) => i.order_id === orderId && i.is_po).reduce((s, i) => s + Number(i.subtotal), 0);

  const poOrdersMenungguBayar = useMemo(() => {
    return poOrders.filter((o) => {
      if (o.status !== 'listed') return false;
      const totalPo = orderTotalPo(o.id);
      const paid = Number(o.paid_amount ?? 0);
      return paid < totalPo;
    });
  }, [poOrders, items]);

  /** Listed + sudah bayar: bisa masih ada item belum received, atau semua received tapi belum klik Selesaikan PO */
  const poOrdersMenungguDiterima = useMemo(() => {
    return poOrders.filter((o) => o.status === 'listed' && o.paid_at);
  }, [poOrders]);

  const poOrdersSelesai = useMemo(() => {
    return poOrders.filter((o) => o.status === 'completed');
  }, [poOrders]);

  const poOrdersForTab = useMemo(() => {
    if (poTab === 'bayar') return poOrdersMenungguBayar;
    if (poTab === 'diterima') return poOrdersMenungguDiterima;
    return poOrdersSelesai;
  }, [poTab, poOrdersMenungguBayar, poOrdersMenungguDiterima, poOrdersSelesai]);

  const paginatedPo = useMemo(() => {
    const from = (pagePo - 1) * PAGE_SIZE;
    return poOrdersForTab.slice(from, from + PAGE_SIZE);
  }, [poOrdersForTab, pagePo]);

  /** Group orders by transaction date (created_at) in WIB */
  function groupOrdersByDate(orderList: Order[]) {
    const map = new Map<string, { dateKey: string; dateLabel: string; orders: Order[] }>();
    for (const o of orderList) {
      const dateKey = getDateKeyWIB(o.created_at);
      const dateLabel = formatDateLabelWIB(o.created_at);
      if (!map.has(dateKey)) map.set(dateKey, { dateKey, dateLabel, orders: [] });
      map.get(dateKey)!.orders.push(o);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, v]) => v);
  }

  async function load() {
    setError(null);
    try {
      await supabase.rpc('auto_receive_po_items');
      const { data: ord, error: ordErr } = await supabase
        .from('orders')
        .select(`
          id, created_at, status, completed_at, approved_by, user_id, paid_at, paid_amount,
          users!user_id(username, name),
          approver:users!approved_by(username, name)
        `)
        .order('created_at', { ascending: false });
      if (ordErr) {
        setError(`Gagal load orders: ${ordErr.message}`);
        setOrders([]);
        setItems([]);
        return;
      }
      setOrders((ord ?? []) as unknown as Order[]);

      const { data: treasuryRows } = await supabase.from('treasury').select('users!user_id(username, name)');
      const raw = (treasuryRows ?? []) as Array<{ users: { username?: string; name?: string } | { username?: string; name?: string }[] | null }>;
      const treasuryList = raw.flatMap((r) => {
        const u = r.users;
        if (!u) return [];
        const arr = Array.isArray(u) ? u : [u];
        return arr.filter((x) => x && (x.username || x.name)).map((x) => ({ username: x!.username ?? '', name: x!.name ?? '' }));
      });
      setTreasuryUsers(treasuryList);

      const orderIds = (ord ?? []).map((o) => o.id);
      if (orderIds.length > 0) {
        const { data: it, error: itErr } = await supabase
          .from('order_items')
          .select('id, order_id, catalog_id, quantity, price_each, subtotal, status, is_po, ready_for_receive_at, received_at, catalog(name, category)')
          .in('order_id', orderIds);
        if (itErr) setError((prev) => (prev ? `${prev}; ` : '') + `Order items: ${itErr.message}`);
        const itemList = (it ?? []) as unknown as OrderItem[];
        setItems(itemList);
        const itemIds = itemList.map((x) => x.id);
        const { data: oiw } = await supabase.from('order_item_weapons').select('order_item_id').in('order_item_id', itemIds);
        setOrderItemWeapons((oiw ?? []) as { order_item_id: string }[]);
      } else {
        setItems([]);
        setOrderItemWeapons([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setOrders([]);
      setItems([]);
    }
  }

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
    })().finally(() => setLoading(false));
  }, []);

  async function markOrderPaid(orderId: string, amount: number) {
    setPayLoading(true);
    setError(null);
    try {
      const { error } = await supabase.from('orders').update({ paid_at: new Date().toISOString(), paid_amount: amount }).eq('id', orderId);
      if (error) throw new Error(error.message);
      setPayModalOrderId(null);
      setPayAmount('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal tandai bayar');
    } finally {
      setPayLoading(false);
    }
  }

  async function markItemReadyForReceive(itemId: string) {
    await supabase.from('order_items').update({ ready_for_receive_at: new Date().toISOString() }).eq('id', itemId);
    await load();
  }

  async function assignSnWeaponPo(orderId: string, itemId: string, catalogId: string, sn: string, userId: string) {
    setSnLoading(true);
    setError(null);
    try {
      const { data: w, error: insErr } = await supabase.from('warehouse_weapons').insert({ catalog_id: catalogId, serial_number: sn, status: 'in_use', owner_id: userId }).select('id').single();
      if (insErr) throw new Error(insErr.code === '23505' ? 'Serial number sudah dipakai' : insErr.message);
      if (!w) throw new Error('Gagal insert weapon');
      const { error: linkErr } = await supabase.from('order_item_weapons').insert({ order_item_id: itemId, warehouse_weapon_id: (w as { id: string }).id });
      if (linkErr) throw new Error(linkErr.message);
      setSnModalItem(null);
      setSnInput('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal assign SN');
    } finally {
      setSnLoading(false);
    }
  }

  async function completePoOrder(orderId: string) {
    setError(null);
    try {
      const { error } = await supabase.rpc('complete_po_order', { p_order_id: orderId });
      if (error) throw new Error(error.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal selesaikan PO');
    }
  }

  const itemsByOrder = (orderId: string) =>
    items.filter((i) => i.order_id === orderId);

  const totalApprovedByOrder = (orderId: string) =>
    items
      .filter((i) => i.order_id === orderId && (i.status === 'approved' || i.status === 'processed'))
      .reduce((s, i) => s + Number(i.subtotal), 0);

  const totalApprovedForOrders = (orderList: Order[]) =>
    orderList.reduce((sum, o) => sum + totalApprovedByOrder(o.id), 0);

  const hasWeaponAssigned = (itemId: string) => orderItemWeapons.some((w) => w.order_item_id === itemId);

  const canCompletePo = (o: Order) => {
    if (!o.paid_at) return false;
    const orderItems = items.filter((i) => i.order_id === o.id && i.is_po);
    if (orderItems.some((i) => !i.received_at)) return false;
    const weaponItems = orderItems.filter((i) => (i.catalog as { category?: string })?.category === 'weapon');
    return weaponItems.every((i) => hasWeaponAssigned(i.id));
  };

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
          <div><span className="text-slate-500">Tanggal:</span> <span className="text-slate-300">{formatDateTimeWIB(o.created_at)}</span></div>
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

  function renderOrderCardPo(o: Order) {
    const orderItems = itemsByOrder(o.id).filter((i) => i.is_po);
    const totalPo = orderTotalPo(o.id);
    const paid = Number(o.paid_amount ?? 0);
    const unpaid = totalPo - paid;
    const buyer = (o.users as { username?: string; name?: string }) ?? {};
    return (
      <div key={o.id} className="rounded-xl border border-amber-500/20 bg-slate-900/60 p-4">
        <div className="grid grid-cols-1 gap-1 text-sm border-b border-slate-800 pb-3">
          <div><span className="text-slate-500">ID:</span> <span className="font-mono text-slate-300">{o.id.slice(0, 8)}…</span></div>
          <div><span className="text-slate-500">Order oleh:</span> <span className="text-slate-200 font-medium">{buyer.username ?? buyer.name ?? '-'}</span></div>
          <div><span className="text-slate-500">Tanggal:</span> <span className="text-slate-300">{formatDateTimeWIB(o.created_at)}</span></div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-slate-500">Status:</span>
            <span className={`rounded px-2 py-0.5 text-xs capitalize ${o.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{o.status}</span>
            <span className="text-slate-400">Total PO: Rp {totalPo.toLocaleString('id-ID')}</span>
            {o.paid_at ? (
              <span className="text-emerald-400">Paid: Rp {paid.toLocaleString('id-ID')}{unpaid > 0 ? ` (sisa Rp ${unpaid.toLocaleString('id-ID')})` : ''}</span>
            ) : (
              <span className="text-amber-400">Belum bayar</span>
            )}
          </div>
          {o.status === 'listed' && !o.paid_at && (
            <Button type="button" variant="primary" className="mt-1 text-xs" onClick={() => { setPayModalOrderId(o.id); setPayAmount(String(paid || totalPo)); }}>Tandai Bayar</Button>
          )}
          {o.status === 'listed' && o.paid_at && unpaid > 0 && (
            <Button type="button" variant="secondary" className="mt-1 text-xs" onClick={() => { setPayModalOrderId(o.id); setPayAmount(String(paid)); }}>Tambah Bayar</Button>
          )}
        </div>
        <div className="mt-3 overflow-x-auto text-xs">
          <table className="w-full min-w-[560px] border-collapse table-fixed">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="p-2 text-left">Item</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Subtotal</th>
                <th className="p-2 text-center">Dikirim</th>
                <th className="p-2 text-center">Diterima</th>
                <th className="p-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {orderItems.map((i) => {
                const isWeapon = (i.catalog as { category?: string })?.category === 'weapon';
                const hasSn = hasWeaponAssigned(i.id);
                return (
                  <tr key={i.id} className="border-b border-slate-800/80">
                    <td className="p-2 truncate">{(i.catalog as { name?: string })?.name ?? '-'}</td>
                    <td className="p-2 text-right">{i.quantity}</td>
                    <td className="p-2 text-right">{Number(i.subtotal).toLocaleString('id-ID')}</td>
                    <td className="p-2 text-center">{i.ready_for_receive_at ? formatDateShortWIB(i.ready_for_receive_at) : '-'}</td>
                    <td className="p-2 text-center">{i.received_at ? formatDateShortWIB(i.received_at) : '-'}</td>
                    <td className="p-2">
                      {o.status === 'listed' && !i.ready_for_receive_at && (
                        <Button type="button" variant="secondary" className="py-1! px-2! min-h-0! text-xs" onClick={() => markItemReadyForReceive(i.id)}>Tandai Dikirim</Button>
                      )}
                      {o.status === 'listed' && isWeapon && !hasSn && (
                        <Button type="button" variant="primary" className="py-1! px-2! min-h-0! text-xs ml-1" onClick={() => setSnModalItem({ orderId: o.id, itemId: i.id, catalogId: i.catalog_id, itemName: (i.catalog as { name?: string })?.name ?? '', userId: o.user_id })}>Assign SN</Button>
                      )}
                      {isWeapon && hasSn && <span className="text-emerald-400 text-xs">SN ✓</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {o.status === 'listed' && canCompletePo(o) && (
          <div className="mt-3 pt-3 border-t border-slate-800">
            <Button type="button" variant="primary" onClick={() => completePoOrder(o.id)}>Selesaikan PO</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
          <p className="mt-1 text-xs text-amber-300/80">Pastikan login sebagai Super Admin atau Treasurer. Cek RLS di Supabase.</p>
        </div>
      )}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5">
        <h1 className="text-xl font-semibold text-slate-50">Orders History</h1>
        <p className="mt-1 text-sm text-slate-400">
          Riwayat order Reguler dan PO. Pilih tab untuk melihat tipe order.
        </p>
      </div>

      <Card
        title="Orders History"
        className={orderTypeTab === 'po' ? 'border-amber-500/30 bg-amber-950/10' : 'border-slate-700/80'}
      >
        <div className="flex gap-2 border-b border-slate-700/80 pb-4 mb-4">
          <button
            type="button"
            onClick={() => setOrderTypeTab('reguler')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              orderTypeTab === 'reguler'
                ? 'bg-bfl-primary/20 text-bfl-primary border border-bfl-primary/40'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            Order Reguler ({regularOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setOrderTypeTab('po')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              orderTypeTab === 'po'
                ? 'bg-amber-500/30 text-amber-200 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            Order PO ({poOrders.length})
          </button>
        </div>

        {orderTypeTab === 'reguler' ? (
          <>
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
          </>
        ) : (
          <>
            <div className="flex gap-2 mb-4 border-b border-amber-500/20 pb-2">
              {(['bayar', 'diterima', 'selesai'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${poTab === tab ? 'bg-amber-500/30 text-amber-200' : 'text-slate-400 hover:text-slate-200'}`}
                  onClick={() => { setPoTab(tab); setPagePo(1); }}
                >
                  {tab === 'bayar' && `Menunggu Bayar (${poOrdersMenungguBayar.length})`}
                  {tab === 'diterima' && `Menunggu Diterima (${poOrdersMenungguDiterima.length})`}
                  {tab === 'selesai' && `Selesai (${poOrdersSelesai.length})`}
                </button>
              ))}
            </div>
            <TableToolbar
              searchPlaceholder="Cari username pembeli…"
              searchValue={search}
              onSearchChange={(v) => { setSearch(v); setPagePo(1); }}
              filters={[
                {
                  label: 'Status:',
                  options: [
                    { value: '', label: 'Semua' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'listed', label: 'Listed' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'cancelled', label: 'Cancelled' },
                  ],
                  value: filterStatus,
                  onChange: (v) => { setFilterStatus(v); setPagePo(1); },
                },
                {
                  label: 'Approver:',
                  options: approverOptions,
                  value: filterApprover,
                  onChange: (v) => { setFilterApprover(v); setPagePo(1); },
                },
              ]}
              totalCount={poOrdersForTab.length}
              page={pagePo}
              pageSize={PAGE_SIZE}
              onPageChange={setPagePo}
            />
            {poOrdersForTab.length === 0 ? (
              <div className="py-8 text-center"><p className="text-slate-400">{poTab === 'bayar' ? 'Tidak ada order menunggu bayar.' : poTab === 'diterima' ? 'Tidak ada order menunggu diterima.' : 'Belum ada order PO selesai.'}</p></div>
            ) : (
              <div className="space-y-4">
                {paginatedPo.map((o) => renderOrderCardPo(o))}
              </div>
            )}
          </>
        )}
      </Card>

      {payModalOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !payLoading && setPayModalOrderId(null)}>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">Tandai Bayar</h3>
            <p className="mt-1 text-sm text-slate-400">Total yang sudah dibayar (Rp). Untuk tambah bayar, isi total kumulatif.</p>
            <input
              type="number"
              min={0}
              className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
            <div className="mt-4 flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => { setPayModalOrderId(null); setPayAmount(''); }} disabled={payLoading}>Batal</Button>
              <Button variant="primary" onClick={() => markOrderPaid(payModalOrderId, Number(payAmount) || 0)} disabled={payLoading}>{payLoading ? '…' : 'Simpan'}</Button>
            </div>
          </div>
        </div>
      )}

      {snModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !snLoading && setSnModalItem(null)}>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">Assign SN Weapon</h3>
            <p className="mt-1 text-sm text-slate-400">Item: {snModalItem.itemName}. Masukkan serial number (barang dari supplier).</p>
            <input
              type="text"
              className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200"
              placeholder="Serial Number"
              value={snInput}
              onChange={(e) => setSnInput(e.target.value)}
            />
            <div className="mt-4 flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => { setSnModalItem(null); setSnInput(''); }} disabled={snLoading}>Batal</Button>
              <Button variant="primary" onClick={() => snInput.trim() && assignSnWeaponPo(snModalItem.orderId, snModalItem.itemId, snModalItem.catalogId, snInput.trim(), snModalItem.userId)} disabled={snLoading || !snInput.trim()}>{snLoading ? '…' : 'Simpan'}</Button>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-sm text-slate-500">
        <Link href="/admin/orders" className="text-bfl-primary hover:underline">← Ke Pending Orders</Link>
      </p>
    </div>
  );
}
