'use client';

import { useEffect, useState, type FormEvent, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { logActivity } from '@/lib/activity';
import { TableToolbar } from '@/components/ui/TableToolbar';
import { ALL_CATEGORIES, CATEGORY_LABELS } from '@/lib/catalog-categories';

type CatalogItem = { id: string; name: string; category: string };
type WarehouseItem = { id: string; catalog_id: string; quantity: number; catalog: { name: string; category?: string } };

export default function AdminWarehousePage() {
  const supabase = createClient();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [catalogId, setCatalogId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
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
    const catalogItem = catalog.find((c) => c.id === catalogId);
    const existing = items.find((i) => i.catalog_id === catalogId);
    if (existing) {
      const newQty = existing.quantity + quantity;
      await supabase.from('warehouse_items').update({ quantity: newQty }).eq('id', existing.id);
      await logActivity(supabase, 'warehouse.add_stock', 'warehouse_items', existing.id, { catalog_id: catalogId, quantity: newQty, item_name: catalogItem?.name });
    } else {
      const { data } = await supabase.from('warehouse_items').insert({ catalog_id: catalogId, quantity }).select('id').single();
      if (data) await logActivity(supabase, 'warehouse.add_stock', 'warehouse_items', (data as { id: string }).id, { catalog_id: catalogId, quantity, item_name: catalogItem?.name });
    }
    setQuantity(0);
    setError(null);
    load();
  }

  async function updateQuantity(id: string, newQty: number) {
    if (newQty < 0) return;
    setUpdatingId(id);
    setError(null);
    const item = items.find((i) => i.id === id);
    const { error: err } = await supabase.from('warehouse_items').update({ quantity: newQty }).eq('id', id);
    setUpdatingId(null);
    if (err) {
      setError(err.message);
      return;
    }
    await logActivity(supabase, 'warehouse.update_quantity', 'warehouse_items', id, { quantity: newQty, item_name: (item?.catalog as { name?: string })?.name });
    load();
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error}</div>
      )}
      <Card title="Warehouse Barang (non-weapon)">
        <p className="mb-4 text-xs text-slate-500">Klik tombol Koreksi untuk mengubah jumlah qty, lalu Simpan atau Batal.</p>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3">
          <select
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
            value={catalogId}
            onChange={(e) => setCatalogId(e.target.value)}
          >
            <option value="">Pilih barang</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({CATEGORY_LABELS[c.category] ?? c.category})</option>
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
                ...ALL_CATEGORIES.filter((cat) => cat !== 'weapon').map((cat) => ({ value: cat, label: CATEGORY_LABELS[cat] ?? cat })),
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
        <div className="mt-2 overflow-x-auto text-sm">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400">
                <th className="p-2 text-left">Barang</th>
                <th className="p-2 text-right w-32">Qty</th>
                <th className="p-2 w-40">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((r) => {
                const isEditing = editingId === r.id;
                const isUpdating = updatingId === r.id;
                return (
                  <tr key={r.id} className="border-t border-slate-800">
                    <td className="p-2">{(r.catalog as { name?: string })?.name ?? '-'}</td>
                    <td className="p-2 text-right">
                      <span className="text-2xl font-semibold tabular-nums text-slate-100">{r.quantity}</span>
                    </td>
                    <td className="p-2">
                      {isEditing ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            className="w-20 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-right text-sm tabular-nums"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = Math.max(0, Number(editValue));
                                if (!Number.isNaN(val)) {
                                  updateQuantity(r.id, val);
                                  setEditingId(null);
                                  setEditValue('');
                                }
                              }
                              if (e.key === 'Escape') {
                                setEditingId(null);
                                setEditValue('');
                              }
                            }}
                            autoFocus
                          />
                          <Button
                            type="button"
                            variant="primary"
                            className="py-1! px-2! min-h-0! text-xs"
                            disabled={isUpdating}
                            onClick={() => {
                              const val = Math.max(0, Number(editValue));
                              if (!Number.isNaN(val)) {
                                updateQuantity(r.id, val);
                                setEditingId(null);
                                setEditValue('');
                              }
                            }}
                          >
                            {isUpdating ? '…' : 'Simpan'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="py-1! px-2! min-h-0! text-xs"
                            disabled={isUpdating}
                            onClick={() => {
                              setEditingId(null);
                              setEditValue('');
                            }}
                          >
                            Batal
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          className="py-1.5! px-3! min-h-0! text-xs"
                          onClick={() => {
                            setEditingId(r.id);
                            setEditValue(String(r.quantity));
                          }}
                        >
                          Koreksi
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
