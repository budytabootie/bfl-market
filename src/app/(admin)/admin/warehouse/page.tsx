'use client';

import { useEffect, useState, type FormEvent, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TableToolbar } from '@/components/ui/TableToolbar';

type CatalogItem = { id: string; name: string; category: string };
type WarehouseItem = { id: string; catalog_id: string; quantity: number; catalog: { name: string; category?: string } };

export default function AdminWarehousePage() {
  const supabase = createClient();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [catalogId, setCatalogId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filteredItems = useMemo(() => {
    let r = items;
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((i) => ((i.catalog as { name?: string })?.name ?? '').toLowerCase().includes(q));
    if (filterCategory) r = r.filter((i) => ((i.catalog as { category?: string })?.category ?? '') === filterCategory);
    return r;
  }, [items, search, filterCategory]);

  const paginatedItems = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(from, from + PAGE_SIZE);
  }, [filteredItems, page]);

  async function load() {
    const { data: c } = await supabase.from('catalog').select('id, name, category').eq('status', 'active').neq('category', 'weapon');
    setCatalog((c ?? []) as unknown as CatalogItem[]);

    const { data: w } = await supabase.from('warehouse_items').select('id, catalog_id, quantity, catalog(name, category)');
    setItems((w ?? []) as unknown as WarehouseItem[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const existing = items.find((i) => i.catalog_id === catalogId);
    if (existing) {
      await supabase.from('warehouse_items').update({ quantity: existing.quantity + quantity }).eq('id', existing.id);
    } else {
      await supabase.from('warehouse_items').insert({ catalog_id: catalogId, quantity });
    }
    setQuantity(0);
    setError(null);
    load();
  }

  async function updateQuantity(id: string, newQty: number) {
    if (newQty < 0) return;
    setUpdatingId(id);
    setError(null);
    const { error: err } = await supabase.from('warehouse_items').update({ quantity: newQty }).eq('id', id);
    setUpdatingId(null);
    if (err) {
      setError(err.message);
      return;
    }
    load();
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error}</div>
      )}
      <Card title="Warehouse Barang (non-weapon)">
        <p className="mb-4 text-xs text-slate-500">Klik quantity untuk edit, lalu tekan Enter atau klik di luar untuk simpan.</p>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3">
          <select
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
            value={catalogId}
            onChange={(e) => setCatalogId(e.target.value)}
          >
            <option value="">Pilih barang</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.category})</option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            className="w-24 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
            value={quantity || ''}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
          <Button type="submit">Tambah Stok</Button>
        </form>
        <TableToolbar
          searchPlaceholder="Cari nama barang…"
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          filters={[
            {
              label: 'Kategori:',
              options: [
                { value: '', label: 'Semua' },
                { value: 'ammo', label: 'Ammo' },
                { value: 'vest', label: 'Vest' },
                { value: 'attachment', label: 'Attachment' },
              ],
              value: filterCategory,
              onChange: (v) => { setFilterCategory(v); setPage(1); },
            },
          ]}
          totalCount={filteredItems.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
        <div className="mt-2 overflow-x-auto text-xs">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400">
                <th className="p-2 text-left">Barang</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((r) => (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="p-2">{(r.catalog as { name?: string })?.name ?? '-'}</td>
                  <td className="p-2 text-right">
                    <input
                      key={`${r.id}-${r.quantity}`}
                      type="number"
                      min={0}
                      defaultValue={r.quantity}
                      disabled={updatingId === r.id}
                      className="number-input w-20 text-right"
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (!Number.isNaN(val) && val !== r.quantity) {
                          updateQuantity(r.id, Math.max(0, val));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                    />
                  </td>
                  <td className="p-2">
                    {updatingId === r.id && <span className="text-xs text-slate-500">Menyimpan…</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
