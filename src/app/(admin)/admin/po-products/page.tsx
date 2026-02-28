'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TableToolbar } from '@/components/ui/TableToolbar';
import Link from 'next/link';

type CatalogRow = {
  id: string;
  name: string;
  category: string;
  base_price: number;
  status: string;
};

type PoProduct = { id: string; catalog_id: string };

const CATEGORY_LABELS: Record<string, string> = {
  ammo: 'Ammo',
  vest: 'Vest',
  attachment: 'Attachment',
  weapon: 'Weapon',
};

export default function AdminPoProductsPage() {
  const supabase = createClient();
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [poProductIds, setPoProductIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [toggling, setToggling] = useState<string | null>(null);

  async function load() {
    const { data: cat } = await supabase
      .from('catalog')
      .select('id, name, category, base_price, status')
      .eq('status', 'active')
      .order('name');
    setCatalog((cat ?? []) as CatalogRow[]);

    const { data: po } = await supabase.from('po_products').select('id, catalog_id');
    const ids = new Set(((po ?? []) as PoProduct[]).map((p) => p.catalog_id));
    setPoProductIds(ids);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const filteredItems = useMemo(() => {
    let r = catalog;
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((i) => i.name.toLowerCase().includes(q));
    if (filterCategory) r = r.filter((i) => i.category === filterCategory);
    return r;
  }, [catalog, search, filterCategory]);

  const paginatedItems = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(from, from + PAGE_SIZE);
  }, [filteredItems, page]);

  async function togglePo(catalogId: string) {
    setToggling(catalogId);
    const isPo = poProductIds.has(catalogId);
    if (isPo) {
      const { error } = await supabase.from('po_products').delete().eq('catalog_id', catalogId);
      if (!error) setPoProductIds((prev) => { const n = new Set(prev); n.delete(catalogId); return n; });
    } else {
      const { error } = await supabase.from('po_products').insert({ catalog_id: catalogId });
      if (!error) setPoProductIds((prev) => new Set([...prev, catalogId]));
    }
    setToggling(null);
  }

  if (loading) return <Card title="Produk PO"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">Produk PO</h1>
          <p className="text-sm text-slate-400 mt-0.5">Pilih produk yang bisa di-PO. Barang di list ini akan muncul di Jatah Mingguan.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/po-weekly">
            <Button variant="secondary">Jatah Mingguan</Button>
          </Link>
          <Link href="/admin/po-settings">
            <Button variant="secondary">Settings</Button>
          </Link>
        </div>
      </div>

      <Card title="Daftar Produk (Active)">
        <TableToolbar
          searchPlaceholder="Cari nama…"
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          filters={[
            {
              label: 'Kategori:',
              options: [{ value: '', label: 'Semua' }, ...['ammo', 'vest', 'attachment', 'weapon'].map((c) => ({ value: c, label: CATEGORY_LABELS[c] ?? c }))],
              value: filterCategory,
              onChange: (v) => { setFilterCategory(v); setPage(1); },
            },
          ]}
          totalCount={filteredItems.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
        <div className="overflow-x-auto text-xs">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400">
                <th className="p-2 text-left">Nama</th>
                <th className="p-2 text-left">Category</th>
                <th className="p-2 text-right">Harga</th>
                <th className="p-2 text-center">PO Eligible</th>
                <th className="p-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((r) => {
                const isPo = poProductIds.has(r.id);
                return (
                  <tr key={r.id} className="border-t border-slate-800">
                    <td className="p-2">{r.name}</td>
                    <td className="p-2">{CATEGORY_LABELS[r.category] ?? r.category}</td>
                    <td className="p-2 text-right">{Number(r.base_price).toLocaleString('id-ID')}</td>
                    <td className="p-2 text-center">
                      {isPo ? (
                        <span className="rounded-lg bg-amber-500/20 px-2 py-1 text-amber-300 text-xs font-medium ring-1 ring-amber-500/30">PO</span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="p-2">
                      <Button
                        variant={isPo ? 'secondary' : 'primary'}
                        onClick={() => togglePo(r.id)}
                        disabled={toggling === r.id}
                      >
                        {toggling === r.id ? '…' : isPo ? 'Hapus dari PO' : 'Tambah ke PO'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {paginatedItems.length === 0 && (
          <p className="py-8 text-center text-slate-500">Tidak ada produk active.</p>
        )}
      </Card>
    </div>
  );
}
