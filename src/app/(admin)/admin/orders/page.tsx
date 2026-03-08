'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { logActivity } from '@/lib/activity';
import { TableToolbar } from '@/components/ui/TableToolbar';

type WarehouseWeaponOption = { id: string; serial_number: string };

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
  catalog: { name: string; category?: string } | null;
};

export default function AdminOrdersPage() {
  const supabase = createClient();
  const [pending, setPending] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pageRegular, setPageRegular] = useState(1);
  const [pagePo, setPagePo] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'reject'; id: string; name: string } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [pendingWeaponApprove, setPendingWeaponApprove] = useState<{ itemId: string; name: string; catalog_id: string; quantity: number } | null>(null);
  const [availableWeapons, setAvailableWeapons] = useState<WarehouseWeaponOption[]>([]);
  const [weaponPickerLoading, setWeaponPickerLoading] = useState(false);
  const [selectedWeaponIds, setSelectedWeaponIds] = useState<string[]>([]);
  const [weaponApproveLoading, setWeaponApproveLoading] = useState(false);
  const PAGE_SIZE = 5;

  const regularOrders = useMemo(() => {
    let r = pending.filter((o) => !items.some((i) => i.order_id === o.id && i.is_po));
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((o) => ((o.users as { username?: string })?.username ?? '').toLowerCase().includes(q));
    return r;
  }, [pending, search, items]);

  const poOrders = useMemo(() => {
    let r = pending.filter((o) => items.some((i) => i.order_id === o.id && i.is_po));
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((o) => ((o.users as { username?: string })?.username ?? '').toLowerCase().includes(q));
    return r;
  }, [pending, search, items]);

  const paginatedRegular = useMemo(() => {
    const from = (pageRegular - 1) * PAGE_SIZE;
    return regularOrders.slice(from, from + PAGE_SIZE);
  }, [regularOrders, pageRegular]);

  const paginatedPo = useMemo(() => {
    const from = (pagePo - 1) * PAGE_SIZE;
    return poOrders.slice(from, from + PAGE_SIZE);
  }, [poOrders, pagePo]);

  async function load() {
    setError(null);
    const { data: ord, error: ordErr } = await supabase
      .from('orders')
      .select('id, created_at, status, user_id, users!user_id(username)')
      .eq('status', 'pending')
      .order('created_at');
    if (ordErr) {
      setError(`Gagal load orders: ${ordErr.message}`);
      setPending([]);
      setItems([]);
      return;
    }
    setPending((ord ?? []) as unknown as Order[]);

    const orderIds = (ord ?? []).map((o) => o.id);
    if (orderIds.length > 0) {
      const { data: it, error: itErr } = await supabase
        .from('order_items')
        .select('id, order_id, catalog_id, quantity, status, is_po, catalog(name, category)')
        .in('order_id', orderIds);
      if (itErr) {
        setError(`Gagal load order items: ${itErr.message}`);
      }
      setItems((it ?? []) as unknown as OrderItem[]);
    } else {
      setItems([]);
    }
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!pendingWeaponApprove) {
      setAvailableWeapons([]);
      setSelectedWeaponIds([]);
      return;
    }
    setWeaponPickerLoading(true);
    supabase
      .from('warehouse_weapons')
      .select('id, serial_number')
      .eq('catalog_id', pendingWeaponApprove.catalog_id)
      .eq('status', 'available')
      .order('serial_number')
      .then(({ data, error }) => {
        if (error) {
          setAvailableWeapons([]);
          setSelectedWeaponIds([]);
        } else {
          const list = (data ?? []) as WarehouseWeaponOption[];
          setAvailableWeapons(list);
          const n = Math.min(pendingWeaponApprove.quantity, list.length);
          const initial = Array.from({ length: pendingWeaponApprove.quantity }, (_, i) => list[i]?.id ?? '');
          setSelectedWeaponIds(initial);
        }
      })
      .finally(() => setWeaponPickerLoading(false));
  }, [pendingWeaponApprove]);

  useEffect(() => {
    if (!pendingWeaponApprove) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !weaponApproveLoading) setPendingWeaponApprove(null);
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [pendingWeaponApprove, weaponApproveLoading]);

  async function approveItem(id: string, warehouseWeaponIds?: string[]) {
    const item = items.find((i) => i.id === id);
    if (warehouseWeaponIds && warehouseWeaponIds.length > 0) {
      const rows = warehouseWeaponIds.filter(Boolean).map((wid) => ({ order_item_id: id, warehouse_weapon_id: wid }));
      const { error: insErr } = await supabase.from('order_item_weapons').insert(rows);
      if (insErr) throw new Error(insErr.message);
      await supabase.from('order_items').update({ status: 'approved' }).eq('id', id);
    } else {
      await supabase.from('order_items').update({ status: 'approved' }).eq('id', id);
    }
    await logActivity(supabase, 'order_item.approve', 'order_items', id, { order_id: item?.order_id, item_name: (item?.catalog as { name?: string })?.name, is_po: item?.is_po, warehouse_weapon_ids: warehouseWeaponIds });
    load();
  }

  async function rejectItem(id: string) {
    const item = items.find((i) => i.id === id);
    await supabase.from('order_items').update({ status: 'rejected' }).eq('id', id);
    await logActivity(supabase, 'order_item.reject', 'order_items', id, { order_id: item?.order_id, item_name: (item?.catalog as { name?: string })?.name, is_po: item?.is_po });
    load();
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      if (confirmAction.type === 'approve') await approveItem(confirmAction.id);
      else await rejectItem(confirmAction.id);
    } finally {
      setConfirmLoading(false);
    }
  }

  async function handleWeaponApproveConfirm() {
    if (!pendingWeaponApprove) return;
    const ids = selectedWeaponIds.filter(Boolean);
    const unique = new Set(ids);
    if (ids.length !== pendingWeaponApprove.quantity || unique.size !== ids.length) return;
    setWeaponApproveLoading(true);
    try {
      await approveItem(pendingWeaponApprove.itemId, ids);
      setPendingWeaponApprove(null);
    } finally {
      setWeaponApproveLoading(false);
    }
  }

  async function processOrder(orderId: string) {
    await supabase.rpc('process_order', { p_order_id: orderId });
    load();
  }

  if (loading) return <Card title="Pending Orders"><p className="text-slate-400">Loading…</p></Card>;

  function renderOrderList(orders: Order[], page: number, setPage: (n: number) => void) {
    return (
      <div className="space-y-4">
        {orders.map((o) => {
            const orderItems = items.filter((i) => i.order_id === o.id);
            const hasApproved = orderItems.some((i) => i.status === 'approved');
            const buyer = (o.users as { username?: string }) ?? {};
            return (
              <div key={o.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="grid grid-cols-1 gap-1 text-sm border-b border-slate-800 pb-3">
                  <div><span className="text-slate-500">ID Transaksi:</span> <span className="font-mono text-slate-300">{o.id.slice(0, 8)}…</span></div>
                  <div><span className="text-slate-500">Order oleh:</span> <span className="text-slate-200 font-medium">{buyer.username ?? '-'}</span></div>
                  <div><span className="text-slate-500">Tanggal:</span> <span className="text-slate-300">{new Date(o.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-slate-500">Status: <span className="text-amber-400">Pending</span></span>
                    {hasApproved && (
                      <Button className="text-xs" onClick={() => processOrder(o.id)}>Process Order</Button>
                    )}
                  </div>
                </div>
                <div className="mt-3 overflow-x-auto text-xs">
                  <table className="w-full min-w-[420px] border-collapse table-fixed">
                    <colgroup>
                      <col style={{ width: '32%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '30%' }} />
                    </colgroup>
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700">
                        <th className="p-2 text-left">Item</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-center">Tipe</th>
                        <th className="p-2 text-center">Status</th>
                        <th className="p-2 text-left">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map((i) => (
                        <tr key={i.id} className="border-b border-slate-800/80">
                          <td className="p-2 truncate" title={(i.catalog as { name?: string })?.name ?? '-'}>{(i.catalog as { name?: string })?.name ?? '-'}</td>
                          <td className="p-2 text-right">{i.quantity}</td>
                          <td className="p-2 text-center">
                            {i.is_po ? (
                              <span className="rounded px-2 py-0.5 text-[11px] bg-amber-500/20 text-amber-300">PO</span>
                            ) : (
                              <span className="text-slate-500">Regular</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <span className={`rounded px-2 py-0.5 text-[11px] ${
                              i.status === 'approved' ? 'bg-emerald-500/20' :
                              i.status === 'rejected' ? 'bg-red-500/20' : 'bg-slate-700'
                            }`}>{i.status}</span>
                          </td>
                          <td className="p-2 text-left align-middle">
                            {i.status === 'pending' ? (
                              <div className="flex flex-wrap gap-1.5">
                                <Button
                                  type="button"
                                  variant="primary"
                                  className="py-1.5! px-3! min-h-0! text-xs"
                                  onClick={() => {
                                    const cat = i.catalog as { name?: string; category?: string } | null;
                                    if (cat?.category === 'weapon') {
                                      setPendingWeaponApprove({ itemId: i.id, name: cat?.name ?? 'Weapon', catalog_id: i.catalog_id, quantity: i.quantity });
                                    } else {
                                      setConfirmAction({ type: 'approve', id: i.id, name: cat?.name ?? 'item ini' });
                                    }
                                  }}
                                >
                                  Approve
                                </Button>
                                <Button type="button" variant="danger" className="py-1.5! px-3! min-h-0! text-xs" onClick={() => setConfirmAction({ type: 'reject', id: i.id, name: (i.catalog as { name?: string })?.name ?? 'item ini' })}>Reject</Button>
                              </div>
                            ) : null}
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
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
          <p className="mt-1 text-xs text-amber-300/80">Pastikan Anda login sebagai Super Admin atau Treasurer. Cek juga RLS policy di Supabase.</p>
        </div>
      )}
      <Card title="Order Reguler" className="border-slate-700/80">
        <TableToolbar
          searchPlaceholder="Cari username…"
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPageRegular(1); setPagePo(1); }}
          totalCount={regularOrders.length}
          page={pageRegular}
          pageSize={PAGE_SIZE}
          onPageChange={setPageRegular}
        />
        {regularOrders.length === 0 ? (
          <p className="py-6 text-center text-slate-500 text-sm">Belum ada order reguler.</p>
        ) : (
          renderOrderList(paginatedRegular, pageRegular, setPageRegular)
        )}
      </Card>

      <Card title="Order PO" className="border-amber-500/30 bg-amber-950/10">
        <TableToolbar
          searchPlaceholder="Cari username…"
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPageRegular(1); setPagePo(1); }}
          totalCount={poOrders.length}
          page={pagePo}
          pageSize={PAGE_SIZE}
          onPageChange={setPagePo}
        />
        {poOrders.length === 0 ? (
          <p className="py-6 text-center text-slate-500 text-sm">Belum ada order PO.</p>
        ) : (
          renderOrderList(paginatedPo, pagePo, setPagePo)
        )}
      </Card>

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.type === 'approve' ? 'Approve item?' : 'Reject item?'}
        message={confirmAction ? (confirmAction.type === 'approve' ? `Approve "${confirmAction.name}"? Item akan masuk ke tagihan yang disetujui.` : `Reject "${confirmAction.name}"? Item tidak akan masuk ke tagihan.`) : ''}
        confirmLabel={confirmAction?.type === 'approve' ? 'Approve' : 'Reject'}
        cancelLabel="Batal"
        variant={confirmAction?.type === 'approve' ? 'primary' : 'danger'}
        onConfirm={handleConfirmAction}
        loading={confirmLoading}
      />

      {pendingWeaponApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !weaponApproveLoading && setPendingWeaponApprove(null)}>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 shadow-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">Pilih SN untuk &quot;{pendingWeaponApprove.name}&quot;</h3>
            <p className="mt-1 text-sm text-slate-400">
              Pilih {pendingWeaponApprove.quantity} serial number (satu per unit). SN akan tercatat di menu Weapons dan diberikan ke pembeli saat order diproses.
            </p>
            {weaponPickerLoading ? (
              <p className="mt-4 text-slate-400 text-sm">Memuat daftar SN…</p>
            ) : availableWeapons.length === 0 ? (
              <p className="mt-4 text-amber-400 text-sm">Tidak ada weapon dengan status &quot;available&quot; untuk item ini.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {Array.from({ length: pendingWeaponApprove.quantity }, (_, idx) => (
                  <div key={idx}>
                    <label className="block text-sm text-slate-400 mb-1">SN unit {idx + 1}</label>
                    <select
                      className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200 text-sm"
                      value={selectedWeaponIds[idx] ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSelectedWeaponIds((prev) => {
                          const next = [...(prev.length ? prev : Array(pendingWeaponApprove.quantity).fill(''))];
                          next[idx] = v;
                          return next;
                        });
                      }}
                      disabled={weaponApproveLoading}
                    >
                      <option value="">— Pilih SN —</option>
                      {availableWeapons
                        .filter((w) => !selectedWeaponIds.some((id, j) => j !== idx && id === w.id))
                        .map((w) => (
                          <option key={w.id} value={w.id}>{w.serial_number}</option>
                        ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex gap-3 justify-end">
              <Button type="button" variant="secondary" onClick={() => setPendingWeaponApprove(null)} disabled={weaponApproveLoading}>Batal</Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleWeaponApproveConfirm}
                disabled={
                  weaponPickerLoading ||
                  availableWeapons.length === 0 ||
                  weaponApproveLoading ||
                  selectedWeaponIds.filter(Boolean).length !== pendingWeaponApprove.quantity ||
                  new Set(selectedWeaponIds.filter(Boolean)).size !== selectedWeaponIds.filter(Boolean).length
                }
              >
                {weaponApproveLoading ? 'Menyimpan…' : `Approve dengan ${pendingWeaponApprove.quantity} SN`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
