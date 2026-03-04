'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TableToolbar } from '@/components/ui/TableToolbar';

type CatalogItem = { id: string; name: string; category: string; base_price: number; image_url?: string | null };

type WeaponAddon = { id: string; name: string; base_price: number };
type WeaponAddons = { attachments: WeaponAddon[]; ammo: WeaponAddon[] };

const CATEGORIES = ['ammo', 'vest', 'attachment', 'weapon', 'barham'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  ammo: 'Ammo',
  vest: 'Vest',
  attachment: 'Attachment',
  weapon: 'Weapon',
  barham: 'Barham',
};

const PAGE_SIZE = 10;

export default function MarketplacePage() {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [relations, setRelations] = useState<Record<string, WeaponAddons>>({});
  const [weaponsForAddon, setWeaponsForAddon] = useState<Record<string, string[]>>({});
  const [selectedAddons, setSelectedAddons] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const getCount = () => {
      try {
        const stored = localStorage.getItem('bfl-cart');
        const entries = stored ? (JSON.parse(stored) as { qty?: number }[]) : [];
        setCartCount(entries.reduce((s, x) => s + (x.qty ?? 1), 0));
      } catch { setCartCount(0); }
    };
    getCount();
    window.addEventListener('cart-update', getCount);
    return () => window.removeEventListener('cart-update', getCount);
  }, []);

  const [addError, setAddError] = useState<string | null>(null);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});

  const addToCart = useCallback(async (ids: string[], isPo = false) => {
    setAddError(null);
    if (isPo) {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('bfl-cart') : null;
      const cart = stored ? JSON.parse(stored) as { id: string; qty: number; isPo?: boolean }[] : [];
      ids.forEach((id) => {
        const existing = cart.find((x) => x.id === id);
        if (existing) { existing.qty += 1; existing.isPo = true; } else { cart.push({ id, qty: 1, isPo: true }); }
      });
      localStorage.setItem('bfl-cart', JSON.stringify(cart));
      window.dispatchEvent(new CustomEvent('cart-update'));
      router.push('/cart');
      router.refresh();
      return;
    }
    const stored = typeof window !== 'undefined' ? localStorage.getItem('bfl-cart') : null;
    const cart = stored ? JSON.parse(stored) as { id: string; qty: number; isPo?: boolean }[] : [];
    const delta: Record<string, number> = {};
    ids.forEach((id) => { delta[id] = (delta[id] ?? 0) + 1; });
    const requested: Record<string, number> = {};
    cart.forEach((x) => { if (!x.isPo) requested[x.id] = (requested[x.id] ?? 0) + x.qty; });
    Object.entries(delta).forEach(([id, d]) => { requested[id] = (requested[id] ?? 0) + d; });
    const catalogIds = Object.keys(requested);
    if (catalogIds.length === 0) return;
    const { data: stockRows } = await supabase.rpc('get_available_stock', { p_catalog_ids: catalogIds });
    const availMap = new Map<string, number>();
    ((stockRows ?? []) as { catalog_id: string; available: number }[]).forEach((r) => availMap.set(r.catalog_id, Number(r.available)));
    const insufficient = catalogIds.find((id) => (availMap.get(id) ?? 0) < (requested[id] ?? 0));
    if (insufficient) {
      const item = items.find((i) => i.id === insufficient);
      setAddError(`Stok tidak cukup untuk ${item?.name ?? 'item'}. Tersedia: ${availMap.get(insufficient) ?? 0}`);
      return;
    }
    ids.forEach((id) => {
      const existing = cart.find((x) => x.id === id);
      if (existing) { existing.qty += 1; existing.isPo = false; } else { cart.push({ id, qty: 1, isPo: false }); }
    });
    localStorage.setItem('bfl-cart', JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent('cart-update'));
    router.push('/cart');
    router.refresh();
  }, [router, supabase, items]);

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
    const addonsInStock = addonIds.filter((id) => (stockMap[id] ?? 0) > 0);
    addToCart([weaponId, ...addonsInStock], false);
    setSelectedAddons((prev) => {
      const next = { ...prev };
      delete next[weaponId];
      return next;
    });
  }, [addToCart, stockMap]);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase
          .from('catalog')
          .select('id, name, category, base_price, image_url')
          .eq('status', 'active')
          .order('category')
          .order('name');
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
        const list = (data ?? []) as CatalogItem[];
        const addonItems = list.filter((i) => i.category === 'attachment' || i.category === 'ammo');
        const addonIds = addonItems.map((a) => a.id);
        const addonMap: Record<string, string[]> = {};
        if (addonIds.length > 0) {
          const { data: relsAddon } = await supabase
            .from('weapon_relations')
            .select('weapon_catalog_id, related_catalog_id')
            .in('related_catalog_id', addonIds);
          const relListAddon = (relsAddon ?? []) as { weapon_catalog_id: string; related_catalog_id: string }[];
          const weaponIdsAddon = [...new Set(relListAddon.map((r) => r.weapon_catalog_id))];
          if (weaponIdsAddon.length > 0) {
            const { data: weapons } = await supabase.from('catalog').select('id, name').in('id', weaponIdsAddon);
            const nameById = new Map(((weapons ?? []) as { id: string; name: string }[]).map((w) => [w.id, w.name]));
            relListAddon.forEach((r) => {
              const name = nameById.get(r.weapon_catalog_id);
              if (!name) return;
              if (!addonMap[r.related_catalog_id]) addonMap[r.related_catalog_id] = [];
              if (!addonMap[r.related_catalog_id].includes(name)) addonMap[r.related_catalog_id].push(name);
            });
          }
          setWeaponsForAddon(addonMap);
        } else {
          setWeaponsForAddon({});
        }
        const allIds = list.map((i) => i.id);
        if (allIds.length > 0) {
          const { data: stockRows } = await supabase.rpc('get_available_stock', { p_catalog_ids: allIds });
          const map: Record<string, number> = {};
          ((stockRows ?? []) as { catalog_id: string; available: number }[]).forEach((r) => { map[r.catalog_id] = Number(r.available); });
          setStockMap(map);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const filteredItems = useMemo(() => {
    let r = items;
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((i) => i.name.toLowerCase().includes(q));
    if (filterCategory) r = r.filter((i) => i.category === filterCategory);
    return r;
  }, [items, search, filterCategory]);

  const paginatedItems = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(from, from + PAGE_SIZE);
  }, [filteredItems, page]);

  if (loading) return <Card title="Marketplace"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <div className="flex flex-col h-full min-h-0 gap-3 sm:gap-4">
      {/* Header + toolbar + CTA ringkas di mobile agar katalog dapat ruang */}
      <div className="flex flex-col gap-3 sm:gap-4 shrink-0">
        {addError && (
          <div className="shrink-0 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex justify-between items-center">
            <span>{addError}</span>
            <button type="button" onClick={() => setAddError(null)} className="text-red-400 hover:text-red-300">×</button>
          </div>
        )}
        {/* Hero: compact on mobile so katalog is visible sooner */}
        <div className="shrink-0 rounded-2xl border border-slate-800/80 bg-linear-to-br from-slate-900/80 to-slate-950/60 p-3 sm:p-4 md:p-6 ring-1 ring-slate-700/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-50 tracking-tight">BFL Marketplace</h1>
              <p className="mt-0.5 sm:mt-2 text-xs sm:text-sm text-slate-400 hidden sm:block">Browse katalog, tambah ke cart, lalu checkout.</p>
            </div>
            <Link href="/po" className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-amber-300 transition-colors hover:bg-amber-500/20">
              Barang PO →
            </Link>
          </div>
        </div>
        {/* Toolbar: search + filter + pagination */}
        <div className="shrink-0">
          <h2 className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wider mb-2 sm:mb-4">Katalog</h2>
          <TableToolbar
            searchPlaceholder="Cari nama produk…"
            searchValue={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            filters={[
              {
                label: 'Kategori:',
                options: [{ value: '', label: 'Semua' }, ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] ?? c }))],
                value: filterCategory,
                onChange: (v) => { setFilterCategory(v); setPage(1); },
              },
            ]}
            totalCount={filteredItems.length}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
        {/* CTA keranjang: compact on mobile, hide text to save space */}
        <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 md:gap-3">
          <p className="text-xs sm:text-sm text-slate-500 hidden sm:block">
            Selesai memilih? Lanjut ke keranjang untuk review dan checkout.
          </p>
          <Link href="/cart" className="sm:hidden w-full">
            <Button className="w-full py-2 text-xs" variant={cartCount > 0 ? 'primary' : 'secondary'}>
              Keranjang {cartCount > 0 ? `(${cartCount})` : ''}
            </Button>
          </Link>
          <Link href="/cart" className="hidden sm:inline-flex">
            <Button className="min-w-[130px] py-2 text-xs" variant={cartCount > 0 ? 'primary' : 'secondary'}>
              <span className="flex items-center justify-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                Lihat Keranjang {cartCount > 0 && `(${cartCount})`}
              </span>
            </Button>
          </Link>
        </div>
      </div>
      {paginatedItems.length === 0 ? (
        <div className="flex-1 min-h-[200px] md:min-h-0 flex items-center justify-center py-8 sm:py-12">
          <p className="text-center text-slate-500 text-sm">Tidak ada produk yang cocok. Coba ubah filter atau kata kunci.</p>
        </div>
      ) : (
      <div className="marketplace-grid-scroll flex-1 min-h-[50vh] md:min-h-0 overflow-y-auto overflow-x-hidden pr-2 -mr-2">
        <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {paginatedItems.map((item) => (
            <Card key={item.id} className="flex flex-col justify-between p-4">
              <div>
                {item.image_url ? (
                  <div className="mb-3 flex justify-center">
                    <div className="aspect-square w-20 overflow-hidden rounded-xl bg-slate-800/40">
                      <img src={item.image_url} alt={item.name} className="block h-full w-full object-cover" />
                    </div>
                  </div>
                ) : (
                  <div className="mb-3 flex justify-center">
                    <div className="aspect-square w-20 rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-500 text-xs">No image</div>
                  </div>
                )}
                <div className="text-sm font-semibold leading-tight line-clamp-2">{item.name}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[11px] uppercase text-slate-500">{item.category}</span>
                  <span className="text-[10px] text-slate-500">Stok: {stockMap[item.id] ?? 0}</span>
                </div>
                <div className="mt-2 text-sm text-emerald-400 font-medium">
                  {Number(item.base_price).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })}
                </div>
                {(item.category === 'attachment' || item.category === 'ammo') && (weaponsForAddon[item.id]?.length ?? 0) > 0 && (
                  <div className="mt-2 rounded-lg border border-slate-700/80 bg-slate-800/40 px-2 py-1.5">
                    <div className="text-[10px] font-medium uppercase text-slate-500 mb-0.5">Untuk senjata</div>
                    <ul className="text-xs text-slate-300 space-y-0.5 list-none pl-0">
                      {weaponsForAddon[item.id].map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {item.category === 'weapon' && ((relations[item.id]?.attachments?.length ?? 0) + (relations[item.id]?.ammo?.length ?? 0) > 0) && (
                  <div className={`mt-2 rounded-lg border border-slate-700/80 bg-slate-800/40 px-2 py-2 ${(stockMap[item.id] ?? 0) <= 0 ? 'opacity-70' : ''}`}>
                    <div className="text-[10px] font-medium uppercase text-slate-500 mb-1.5">
                      Add-ons (jika ada stok)
                      {(stockMap[item.id] ?? 0) <= 0 && <span className="block mt-0.5 text-amber-400/90 font-normal normal-case">Stok senjata habis — add-on tidak bisa dipilih</span>}
                    </div>
                    {relations[item.id]?.attachments && relations[item.id].attachments.length > 0 && (
                      <div className="space-y-1">
                        {relations[item.id].attachments.map((a) => {
                          const addonStock = stockMap[a.id] ?? 0;
                          const addonOutOfStock = addonStock <= 0;
                          const weaponOutOfStock = (stockMap[item.id] ?? 0) <= 0;
                          const disabled = addonOutOfStock || weaponOutOfStock;
                          return (
                            <label
                              key={a.id}
                              className={`flex items-center gap-2 text-xs ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedAddons[item.id]?.has(a.id) ?? false}
                                onChange={() => !disabled && toggleAddon(item.id, a.id)}
                                disabled={disabled}
                                className="checkbox-input"
                              />
                              <span className="truncate">{a.name}</span>
                              <span className="text-[10px] text-slate-500 shrink-0">
                                {addonOutOfStock ? 'Stok habis' : `Stok: ${addonStock}`}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {relations[item.id]?.ammo && relations[item.id].ammo.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {relations[item.id].ammo.map((a) => {
                          const addonStock = stockMap[a.id] ?? 0;
                          const addonOutOfStock = addonStock <= 0;
                          const weaponOutOfStock = (stockMap[item.id] ?? 0) <= 0;
                          const disabled = addonOutOfStock || weaponOutOfStock;
                          return (
                            <label
                              key={a.id}
                              className={`flex items-center gap-2 text-xs ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedAddons[item.id]?.has(a.id) ?? false}
                                onChange={() => !disabled && toggleAddon(item.id, a.id)}
                                disabled={disabled}
                                className="checkbox-input"
                              />
                              <span className="truncate">{a.name}</span>
                              <span className="text-[10px] text-slate-500 shrink-0">
                                {addonOutOfStock ? 'Stok habis' : `Stok: ${addonStock}`}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button
                className="mt-3 w-full text-sm py-2"
                disabled={(stockMap[item.id] ?? 0) <= 0}
                onClick={() =>
                  item.category === 'weapon'
                    ? addWeaponToCart(item.id, Array.from(selectedAddons[item.id] ?? []))
                    : addToCart([item.id], false)
                }
              >
                {(stockMap[item.id] ?? 0) <= 0 ? 'Stok habis' : 'Add to Cart'}
              </Button>
            </Card>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
