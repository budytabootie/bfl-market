'use client';

import { useEffect, useState, type FormEvent, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { logActivity } from '@/lib/activity';
import { TableToolbar } from '@/components/ui/TableToolbar';

type CatalogWeapon = { id: string; name: string };
type WarehouseWeapon = {
  id: string;
  serial_number: string;
  status: string;
  catalog: { name: string };
  users: { username: string } | null;
};

const STATUSES = ['available', 'in_use', 'broken', 'lost', 'confiscated'] as const;

export default function AdminWeaponsPage() {
  const supabase = createClient();
  const [catalog, setCatalog] = useState<CatalogWeapon[]>([]);
  const [weapons, setWeapons] = useState<WarehouseWeapon[]>([]);
  const [catalogId, setCatalogId] = useState('');
  const [serial, setSerial] = useState('');
  const [status, setStatus] = useState<typeof STATUSES[number]>('available');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filteredWeapons = useMemo(() => {
    let r = weapons;
    const q = search.trim().toLowerCase();
    if (q) {
      r = r.filter((w) => {
        const catName = ((w.catalog as { name?: string })?.name ?? '').toLowerCase();
        const serial = (w.serial_number ?? '').toLowerCase();
        return catName.includes(q) || serial.includes(q);
      });
    }
    if (filterStatus) r = r.filter((w) => w.status === filterStatus);
    return r;
  }, [weapons, search, filterStatus]);

  const paginatedWeapons = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredWeapons.slice(from, from + PAGE_SIZE);
  }, [filteredWeapons, page]);

  async function load() {
    const { data: c } = await supabase.from('catalog').select('id, name').eq('category', 'weapon').eq('status', 'active');
    setCatalog((c ?? []) as unknown as CatalogWeapon[]);

    const { data: w } = await supabase.from('warehouse_weapons').select('id, serial_number, status, catalog(name), users(username)');
    setWeapons((w ?? []) as unknown as WarehouseWeapon[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const catalogItem = catalog.find((c) => c.id === catalogId);
    const { data } = await supabase.from('warehouse_weapons').insert({ catalog_id: catalogId, serial_number: serial, status }).select('id').single();
    if (data) await logActivity(supabase, 'weapons.add', 'warehouse_weapons', (data as { id: string }).id, { catalog_id: catalogId, serial_number: serial, item_name: catalogItem?.name });
    setSerial('');
    load();
  }

  async function updateStatus(id: string, s: string) {
    const item = weapons.find((w) => w.id === id);
    await supabase.from('warehouse_weapons').update({ status: s }).eq('id', id);
    await logActivity(supabase, 'weapons.update_status', 'warehouse_weapons', id, { status: s, item_name: (item?.catalog as { name?: string })?.name });
    load();
  }

  return (
    <div className="space-y-6">
      <Card title="Tambah Weapon">
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3">
          <select
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
            value={catalogId}
            onChange={(e) => setCatalogId(e.target.value)}
          >
            <option value="">Pilih weapon</option>
            {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
            placeholder="Serial Number"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            required
          />
          <select
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof STATUSES[number])}
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button type="submit">Tambah</Button>
        </form>
      </Card>
      <Card title="Daftar Weapons">
        <div className="overflow-x-auto text-xs">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400">
                <th className="p-2 text-left">Barang</th>
                <th className="p-2 text-left">Serial</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Owner</th>
                <th className="p-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedWeapons.map((r) => (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="p-2">{(r.catalog as { name?: string })?.name ?? '-'}</td>
                  <td className="p-2 font-mono">{r.serial_number}</td>
                  <td className="p-2">
                    <select
                      className="rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[11px]"
                      value={r.status}
                      onChange={(e) => updateStatus(r.id, e.target.value)}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="p-2">{(r.users as { username?: string })?.username ?? '-'}</td>
                  <td className="p-2">-</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
