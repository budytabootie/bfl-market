'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type CatalogItem = { id: string; name: string; category: string };
type WarehouseItem = { id: string; catalog_id: string; quantity: number; catalog: { name: string } };

export default function AdminWarehousePage() {
  const supabase = createClient();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [catalogId, setCatalogId] = useState('');
  const [quantity, setQuantity] = useState(0);

  async function load() {
    const { data: c } = await supabase.from('catalog').select('id, name, category').eq('status', 'active').neq('category', 'weapon');
    setCatalog((c ?? []) as unknown as CatalogItem[]);

    const { data: w } = await supabase.from('warehouse_items').select('id, catalog_id, quantity, catalog(name)');
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
    load();
  }

  return (
    <div className="space-y-6">
      <Card title="Warehouse Barang (non-weapon)">
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
        <div className="mt-4 overflow-x-auto text-xs">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400">
                <th className="p-2 text-left">Barang</th>
                <th className="p-2 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="p-2">{(r.catalog as { name?: string })?.name ?? '-'}</td>
                  <td className="p-2 text-right">{r.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
