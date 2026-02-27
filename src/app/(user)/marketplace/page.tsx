'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type CatalogItem = { id: string; name: string; category: string; base_price: number };

const CATEGORIES = ['ammo', 'vest', 'attachment', 'weapon'] as const;

export default function MarketplacePage() {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  const addToCart = useCallback((id: string) => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('bfl-cart') : null;
    const ids = stored ? JSON.parse(stored) as { id: string; qty: number }[] : [];
    const existing = ids.find((x) => x.id === id);
    if (existing) existing.qty += 1;
    else ids.push({ id, qty: 1 });
    localStorage.setItem('bfl-cart', JSON.stringify(ids));
    router.push('/cart?add=' + id);
    router.refresh();
  }, [router]);

  useEffect(() => {
    void (async () => {
      try {
        let q = supabase.from('catalog').select('id, name, category, base_price').eq('status', 'active');
        if (filter) q = q.eq('category', filter);
        const { data } = await q.order('category').order('name');
        setItems((data ?? []) as CatalogItem[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, filter]);

  if (loading) return <Card title="Marketplace"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-bfl-card/60 to-slate-950/60 p-5">
        <h1 className="text-xl font-semibold text-slate-50">BFL Marketplace</h1>
        <p className="mt-1 text-sm text-slate-400">Browse item katalog, tambah ke cart, lalu checkout. Admin akan memproses order Anda.</p>
      </div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Katalog</h2>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded-xl px-3 py-1.5 text-xs ${!filter ? 'bg-bfl-primary/20 text-bfl-primary' : 'bg-slate-800 text-slate-300'}`}
            onClick={() => setFilter('')}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`rounded-xl px-3 py-1.5 text-xs capitalize ${filter === c ? 'bg-bfl-primary/20 text-bfl-primary' : 'bg-slate-800 text-slate-300'}`}
              onClick={() => setFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item.id} className="flex flex-col justify-between">
            <div>
              <div className="text-sm font-semibold">{item.name}</div>
              <div className="mt-1 text-[11px] uppercase text-slate-500">{item.category}</div>
              <div className="mt-2 text-emerald-400">
                {Number(item.base_price).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })}
              </div>
            </div>
            <Button className="mt-4 w-full" onClick={() => addToCart(item.id)}>Add to Cart</Button>
          </Card>
        ))}
      </div>
      <div className="flex justify-end">
        <Link href="/cart">
          <Button>View Cart</Button>
        </Link>
      </div>
    </div>
  );
}
