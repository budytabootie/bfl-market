'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { TableToolbar } from '@/components/ui/TableToolbar';

type Log = {
  id: string;
  created_at: string;
  username: string | null;
  role_key: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
};

const ACTION_LABELS: Record<string, string> = {
  'catalog.create': 'Buat Katalog',
  'catalog.update': 'Update Katalog',
  'catalog.delete': 'Hapus Katalog',
  'catalog.toggle_status': 'Toggle Status Katalog',
  'warehouse.add_stock': 'Tambah Stok',
  'warehouse.update_quantity': 'Update Quantity',
  'weapons.add': 'Tambah Weapon',
  'weapons.update_status': 'Update Status Weapon',
  'weapon_relations.add': 'Tambah Relasi Weapon',
  'weapon_relations.delete': 'Hapus Relasi Weapon',
  'po_products.add': 'Tambah ke Produk PO',
  'po_products.remove': 'Hapus dari Produk PO',
  'po_weekly.toggle_on': 'Aktifkan Jatah Mingguan',
  'po_weekly.toggle_off': 'Nonaktifkan Jatah Mingguan',
  'po_weekly.save_max_qty': 'Simpan Max Quantity',
  'po_settings.save_week_start': 'Simpan Pengaturan Minggu',
  'order_item.approve': 'Approve Order Item',
  'order_item.reject': 'Reject Order Item',
  'order.processed': 'Process Order',
  'users.create': 'Buat User',
  'users.update': 'Update User',
  'users.delete': 'Hapus User',
  'users.reset_password': 'Reset Password',
  'treasury.create': 'Tambah Treasury',
  'treasury.update': 'Update Treasury',
  'treasury.delete': 'Hapus Treasury',
};

const ENTITY_LABELS: Record<string, string> = {
  catalog: 'Katalog',
  orders: 'Order',
  warehouse_items: 'Gudang',
  warehouse_weapons: 'Weapons',
  weapon_relations: 'Relasi Weapon',
  po_products: 'Produk PO',
  po_weekly_availability: 'Jatah Mingguan',
  app_settings: 'Pengaturan',
  order_items: 'Order Item',
  users: 'User',
  treasury: 'Treasury',
};

function formatAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function formatEntity(entity: string | null): string {
  if (!entity) return '-';
  return ENTITY_LABELS[entity] ?? entity;
}

function DetailsCell({ details }: { details: Record<string, unknown> | null }) {
  if (!details || Object.keys(details).length === 0) return <span className="text-slate-500">-</span>;
  const entries = Object.entries(details).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return <span className="text-slate-500">-</span>;
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
      {entries.map(([k, v]) => (
        <span key={k} className="text-slate-400">
          <span className="text-slate-500">{k}:</span>{' '}
          <span className="text-slate-300">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
        </span>
      ))}
    </div>
  );
}

export default function AdminActivityPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500);
        setLogs((data ?? []) as Log[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const actionOptions = useMemo(() => {
    const seen = new Set<string>();
    logs.forEach((l) => seen.add(l.action));
    return [{ value: '', label: 'Semua Action' }, ...Array.from(seen).sort().map((a) => ({ value: a, label: formatAction(a) }))];
  }, [logs]);

  const entityOptions = useMemo(() => {
    const seen = new Set<string>();
    logs.forEach((l) => l.entity && seen.add(l.entity));
    return [{ value: '', label: 'Semua Entity' }, ...Array.from(seen).sort().map((e) => ({ value: e, label: formatEntity(e) }))];
  }, [logs]);

  const userOptions = useMemo(() => {
    const seen = new Set<string>();
    logs.forEach((l) => l.username && seen.add(l.username));
    return [{ value: '', label: 'Semua User' }, ...Array.from(seen).sort().map((u) => ({ value: u, label: u }))];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let r = logs;
    const q = search.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (l) =>
          (l.action ?? '').toLowerCase().includes(q) ||
          (l.entity ?? '').toLowerCase().includes(q) ||
          (l.username ?? '').toLowerCase().includes(q) ||
          JSON.stringify(l.details ?? {}).toLowerCase().includes(q)
      );
    }
    if (filterAction) r = r.filter((l) => l.action === filterAction);
    if (filterEntity) r = r.filter((l) => l.entity === filterEntity);
    if (filterUser) r = r.filter((l) => l.username === filterUser);
    return r;
  }, [logs, search, filterAction, filterEntity, filterUser]);

  const paginatedLogs = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredLogs.slice(from, from + PAGE_SIZE);
  }, [filteredLogs, page]);

  if (loading) return <Card title="Log Aktivitas"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <Card title="Log Aktivitas">
      <p className="text-sm text-slate-400 mb-4">Riwayat aktivitas admin di panel ini.</p>
      <TableToolbar
        searchPlaceholder="Cari action, entity, user, details…"
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        filters={[
          { label: 'Action:', options: actionOptions, value: filterAction, onChange: (v) => { setFilterAction(v); setPage(1); } },
          { label: 'Entity:', options: entityOptions, value: filterEntity, onChange: (v) => { setFilterEntity(v); setPage(1); } },
          { label: 'User:', options: userOptions, value: filterUser, onChange: (v) => { setFilterUser(v); setPage(1); } },
        ]}
        totalCount={filteredLogs.length}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
      <div className="overflow-x-auto text-xs">
        <table className="w-full">
          <thead>
            <tr className="text-slate-400">
              <th className="p-2 text-left">Waktu</th>
              <th className="p-2 text-left">User</th>
              <th className="p-2 text-left">Action</th>
              <th className="p-2 text-left">Entity</th>
              <th className="p-2 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLogs.map((l) => (
              <tr key={l.id} className="border-t border-slate-800">
                <td className="p-2 text-slate-300 whitespace-nowrap">{new Date(l.created_at).toLocaleString('id-ID')}</td>
                <td className="p-2 text-slate-300">{l.username ?? '-'}</td>
                <td className="p-2">
                  <span className="rounded px-2 py-0.5 bg-slate-700/80 text-slate-200" title={l.action}>
                    {formatAction(l.action)}
                  </span>
                </td>
                <td className="p-2 text-slate-300">{formatEntity(l.entity)}</td>
                <td className="p-2 max-w-[280px]">
                  <DetailsCell details={l.details ?? null} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginatedLogs.length === 0 && (
        <p className="py-8 text-center text-slate-500">Tidak ada log aktivitas.</p>
      )}
    </Card>
  );
}
