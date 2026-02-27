'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type CatalogRow = {
  id: string;
  name: string;
  category: string;
  base_price: number;
  status: string;
};

const CATEGORIES = ['ammo', 'vest', 'attachment', 'weapon'] as const;
const STATUSES = ['active', 'inactive'] as const;

export default function AdminCatalogPage() {
  const supabase = createClient();
  const [items, setItems] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('ammo');
  const [basePrice, setBasePrice] = useState(0);
  const [status, setStatus] = useState<typeof STATUSES[number]>('active');

  async function load() {
    const { data } = await supabase.from('catalog').select('*').order('name');
    setItems((data ?? []) as CatalogRow[]);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await supabase.from('catalog').insert({ name, category, base_price: basePrice, status });
    setName('');
    setBasePrice(0);
    setStatus('active');
    load();
  }

  async function toggleStatus(id: string, s: string) {
    await supabase.from('catalog').update({ status: s === 'active' ? 'inactive' : 'active' }).eq('id', id);
    load();
  }

  if (loading) return <Card title="Katalog"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <div className="space-y-6">
      <Card title="Tambah Barang">
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3">
          <input
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
            placeholder="Nama"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <select
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof CATEGORIES[number])}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="number"
            className="w-32 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
            placeholder="Harga"
            value={basePrice || ''}
            onChange={(e) => setBasePrice(Number(e.target.value))}
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
      <Card title="Daftar Barang">
        <div className="overflow-x-auto text-xs">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400">
                <th className="p-2 text-left">Nama</th>
                <th className="p-2 text-left">Category</th>
                <th className="p-2 text-right">Harga</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{r.category}</td>
                  <td className="p-2 text-right">{Number(r.base_price).toLocaleString('id-ID')}</td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      className={`rounded px-2 py-0.5 text-[11px] ${r.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}
                      onClick={() => toggleStatus(r.id, r.status)}
                    >
                      {r.status}
                    </button>
                  </td>
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
