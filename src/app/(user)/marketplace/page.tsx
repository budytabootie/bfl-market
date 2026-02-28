'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type CatalogItem = { id: string; name: string; category: string; base_price: number; image_url?: string | null };

type WeaponAddon = { id: string; name: string; base_price: number };
type WeaponAddons = { attachments: WeaponAddon[]; ammo: WeaponAddon[] };

const CATEGORIES = ['ammo', 'vest', 'attachment', 'weapon'] as const;

export default function MarketplacePage() {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [relations, setRelations] = useState<Record<string, WeaponAddons>>({});
  const [selectedAddons, setSelectedAddons] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  const addToCart = useCallback((ids: string[]) => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('bfl-cart') : null;
    const cart = stored ? JSON.parse(stored) as { id: string; qty: number }[] : [];
    ids.forEach((id) => {
      const existing = cart.find((x) => x.id === id);
      if (existing) existing.qty += 1;
      else cart.push({ id, qty: 1 });
    });
    localStorage.setItem('bfl-cart', JSON.stringify(cart));
    router.push('/cart');
    router.refresh();
  }, [router]);

  const toggleAddon = useCallback((weaponId: string, addonId: string) => {
    setSelectedAddons((prev) => {
      const next = { ...prev };
      const set = new Set(next[weaponId] ?? []);
      if (set.has(addonId)) set.delete(addonId);
      else set.add(addonId);
      next[weaponId] = set;
      return next;
    });
  }, []);

  const addWeaponToCart = useCallback((weaponId: string, addonIds: string[] = []) => {
    addToCart([weaponId, ...addonIds]);
    setSelectedAddons((prev) => {
      const next = { ...prev };
      delete next[weaponId];
      return next;
    });
  }, [addToCart]);

  useEffect(() => {
    void (async () => {
      try {
        let q = supabase.from('catalog').select('id, name, category, base_price, image_url').eq('status', 'active');
        if (filter) q = q.eq('category', filter);
        const { data } = await q.order('category').order('name');
        setItems((data ?? []) as CatalogItem[]);

        const weapons = ((data ?? []) as CatalogItem[]).filter((i) => i.category === 'weapon');
        const weaponIds = weapons.map((w) => w.id);

        const relMap: Record<string, WeaponAddons> = {};
        weaponIds.forEach((id) => { relMap[id] = { attachments: [], ammo: [] }; });

        if (weaponIds.length > 0) {
          const { data: rels } = await supabase
            .from('weapon_relations')
            .select('weapon_catalog_id, related_catalog_id, relation_type')
            .in('weapon_catalog_id', weaponIds);
          const relList = (rels ?? []) as { weapon_catalog_id: string; related_catalog_id: string; relation_type: string }[];
          const relatedIds = [...new Set(relList.map((r) => r.related_catalog_id))];
          if (relatedIds.length > 0) {
            const { data: cats } = await supabase
              .from('catalog')
              .select('id, name, base_price')
              .in('id', relatedIds)
              .eq('status', 'active');
            const catMap = new Map(((cats ?? []) as WeaponAddon[]).map((c) => [c.id, c]));
            relList.forEach((r) => {
              const cat = catMap.get(r.related_catalog_id);
              if (!cat) return;
              const key = r.relation_type === 'ammo' ? 'ammo' : 'attachments';
              const arr = relMap[r.weapon_catalog_id]?.[key] ?? [];
              if (!arr.some((a) => a.id === cat.id)) {
                relMap[r.weapon_catalog_id][key] = [...arr, cat];
              }
            });
          }
          setRelations(relMap);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, filter]);

  if (loading) return <Card title="Marketplace"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800/80 bg-linear-to-br from-slate-900/80 to-slate-950/60 p-6 ring-1 ring-slate-700/30">
        <h1 className="text-xl font-bold text-slate-50 tracking-tight">BFL Marketplace</h1>
        <p className="mt-2 text-sm text-slate-400">Browse item katalog, tambah ke cart, lalu checkout. Admin akan memproses order Anda.</p>
      </div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Katalog</h2>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-xs font-medium transition-all ${!filter ? 'bg-bfl-primary/20 text-bfl-primary ring-1 ring-bfl-primary/30' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 hover:text-slate-300'}`}
            onClick={() => setFilter('')}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`rounded-lg px-4 py-2 text-xs font-medium capitalize transition-all ${filter === c ? 'bg-bfl-primary/20 text-bfl-primary ring-1 ring-bfl-primary/30' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 hover:text-slate-300'}`}
              onClick={() => setFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <Card key={item.id} className="flex flex-col justify-between">
            <div>
              {item.image_url ? (
                <div className="mb-3 flex justify-center">
                  <div className="aspect-square w-1/2 overflow-hidden rounded-xl bg-slate-800/40">
                    <img src={item.image_url} alt={item.name} className="block h-full w-full object-cover" />
                  </div>
                </div>
              ) : (
                <div className="mb-3 flex justify-center">
                  <div className="aspect-square w-1/2 rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-500 text-xs">No image</div>
                </div>
              )}
              <div className="text-sm font-semibold">{item.name}</div>
              <div className="mt-1 text-[11px] uppercase text-slate-500">{item.category}</div>
              <div className="mt-2 text-emerald-400">
                {Number(item.base_price).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })}
              </div>
              {item.category === 'weapon' && ((relations[item.id]?.attachments?.length ?? 0) + (relations[item.id]?.ammo?.length ?? 0) > 0) && (
                <div className="mt-2 rounded-lg border border-slate-700/80 bg-slate-800/40 px-2 py-2">
                  <div className="text-[10px] font-medium uppercase text-slate-500 mb-1.5">Recommended add-ons</div>
                  {relations[item.id]?.attachments && relations[item.id].attachments.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400">Attachments (include saat Add to Cart):</div>
                      {relations[item.id].attachments.map((a) => (
                        <label key={a.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedAddons[item.id]?.has(a.id) ?? false}
                            onChange={() => toggleAddon(item.id, a.id)}
                            className="checkbox-input"
                          />
                          <span className="truncate">{a.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {relations[item.id]?.ammo && relations[item.id].ammo.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      <div className="text-[10px] text-slate-400">Ammo (include saat Add to Cart):</div>
                      {relations[item.id].ammo.map((a) => (
                        <label key={a.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedAddons[item.id]?.has(a.id) ?? false}
                            onChange={() => toggleAddon(item.id, a.id)}
                            className="checkbox-input"
                          />
                          <span className="truncate">{a.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button
              className="mt-4 w-full"
              onClick={() =>
                item.category === 'weapon'
                  ? addWeaponToCart(item.id, Array.from(selectedAddons[item.id] ?? []))
                  : addToCart([item.id])
              }
            >
              Add to Cart
            </Button>
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
