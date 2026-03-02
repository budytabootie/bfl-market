'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type CartItem = { id: string; name: string; category: string; base_price: number; quantity: number; isPo: boolean };

export default function CartPage() {
  const searchParams = useSearchParams();
  const addId = searchParams.get('add');
  const supabase = createClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const processedAddRef = useRef<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('bfl-cart') : null;
    const entries = stored ? JSON.parse(stored) as { id: string; qty: number; isPo?: boolean }[] : [];
    if (addId && processedAddRef.current !== addId) {
      processedAddRef.current = addId;
      const existing = entries.find((x) => x.id === addId);
      if (existing) existing.qty += 1;
      else entries.push({ id: addId, qty: 1, isPo: false });
      localStorage.setItem('bfl-cart', JSON.stringify(entries));
      window.dispatchEvent(new CustomEvent('cart-update'));
      window.history.replaceState({}, '', '/cart');
    }
    if (entries.length === 0) {
      setCart([]);
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const { data } = await supabase.from('catalog').select('id, name, category, base_price').in('id', entries.map((x) => x.id));
        const catalogItems = (data ?? []) as { id: string; name: string; category: string; base_price: number }[];
        const newCart = entries.map((x) => {
          const item = catalogItems.find((i) => i.id === x.id);
          return item ? { ...item, quantity: x.qty, isPo: Boolean(x.isPo) } : null;
        }).filter(Boolean) as CartItem[];
        setCart(newCart);

        const regularIds = newCart.filter((c) => !c.isPo).map((c) => c.id);
        if (regularIds.length > 0) {
          const { data: stockRows } = await supabase.rpc('get_available_stock', { p_catalog_ids: regularIds });
          const map: Record<string, number> = {};
          ((stockRows ?? []) as { catalog_id: string; available: number }[]).forEach((r) => { map[r.catalog_id] = Number(r.available); });
          setStockMap(map);
        } else {
          setStockMap({});
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, addId]);

  const total = useMemo(() => cart.reduce((s, i) => s + Number(i.base_price) * i.quantity, 0), [cart]);

  const canCheckout = useMemo(() => {
    return !cart.some((c) => !c.isPo && (stockMap[c.id] ?? 0) < c.quantity);
  }, [cart, stockMap]);

  function updateQty(id: string, qty: number) {
    const next = cart.map((c) => (c.id === id ? { ...c, quantity: Math.max(0, qty) } : c)).filter((c) => c.quantity > 0);
    setCart(next);
    const stored = next.map((c) => ({ id: c.id, qty: c.quantity, isPo: c.isPo }));
    localStorage.setItem('bfl-cart', JSON.stringify(stored));
    window.dispatchEvent(new CustomEvent('cart-update'));
  }

  if (loading) return <Card title="Keranjang"><p className="text-slate-400">Memuat keranjang…</p></Card>;

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      <div className="rounded-2xl border border-slate-800/80 bg-linear-to-br from-bfl-card/60 to-slate-950/60 p-5">
        <h1 className="text-xl font-semibold text-slate-50">Keranjang</h1>
        <p className="mt-1 text-sm text-slate-400">Review item dan lanjut checkout jika sudah sesuai.</p>
      </div>

      {cart.length === 0 ? (
        <Card className="text-center py-16">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/80">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-slate-200">Keranjang kosong</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto">Belum ada item di keranjang. Mulai belanja dari marketplace atau cek barang PO minggu ini.</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/marketplace">
              <Button className="w-full sm:w-auto">Belanja Marketplace</Button>
            </Link>
            <Link href="/po">
              <Button variant="secondary" className="w-full sm:w-auto border-amber-500/40 text-amber-300 hover:bg-amber-500/10">
                Lihat Barang PO
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="py-3 px-4 text-left font-medium">Item</th>
                  <th className="py-3 px-4 text-center w-24 font-medium">Tipe</th>
                  <th className="py-3 px-4 text-right font-medium">Harga</th>
                  <th className="py-3 px-4 text-center font-medium">Jumlah</th>
                  <th className="py-3 px-4 text-right font-medium">Subtotal</th>
                  <th className="py-3 px-4 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((c) => (
                  <tr key={c.id} className="border-b border-slate-800/60">
                    <td className="py-4 px-4">
                      <div className="text-slate-200 font-medium">{c.name}</div>
                      {!c.isPo && (
                        <div className={`text-[11px] mt-0.5 ${(stockMap[c.id] ?? 0) < c.quantity ? 'text-red-400' : 'text-slate-500'}`}>
                          Stok: {stockMap[c.id] ?? 0} {(stockMap[c.id] ?? 0) < c.quantity && '— tidak cukup'}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {c.isPo ? (
                        <span className="inline-flex rounded-md bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-500/30">PO</span>
                      ) : (
                        <span className="text-slate-500 text-xs">Regular</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right text-slate-300">{Number(c.base_price).toLocaleString('id-ID')}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-0">
                        <QuantityControls
                          value={c.quantity}
                          max={!c.isPo ? (stockMap[c.id] ?? undefined) : undefined}
                          onChange={(q) => updateQty(c.id, q)}
                        />
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right font-medium text-emerald-400">{(Number(c.base_price) * c.quantity).toLocaleString('id-ID')}</td>
                    <td className="py-4 px-4">
                      <button
                        type="button"
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                        onClick={() => updateQty(c.id, 0)}
                        aria-label={`Hapus ${c.name}`}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {cart.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-200 truncate">{c.name}</div>
                    {!c.isPo && (
                      <div className={`text-[11px] ${(stockMap[c.id] ?? 0) < c.quantity ? 'text-red-400' : 'text-slate-500'}`}>
                        Stok: {stockMap[c.id] ?? 0} {(stockMap[c.id] ?? 0) < c.quantity && '— tidak cukup'}
                      </div>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      {c.isPo ? (
                        <span className="inline-flex rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">PO</span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Regular</span>
                      )}
                      <span className="text-slate-400 text-xs">{Number(c.base_price).toLocaleString('id-ID')} × {c.quantity}</span>
                    </div>
                    <div className="mt-2 font-semibold text-emerald-400">{(Number(c.base_price) * c.quantity).toLocaleString('id-ID')}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <QuantityControls
                      value={c.quantity}
                      max={!c.isPo ? (stockMap[c.id] ?? undefined) : undefined}
                      onChange={(q) => updateQty(c.id, q)}
                    />
                    <button
                      type="button"
                      className="text-xs text-red-400 hover:text-red-300"
                      onClick={() => updateQty(c.id, 0)}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pt-4">
            <Link href="/marketplace" className="text-sm text-slate-400 hover:text-bfl-primary transition-colors order-2 sm:order-1">
              ← Lanjut belanja
            </Link>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 order-1 sm:order-2">
              <div className="text-right">
                <span className="text-sm text-slate-400">Total: </span>
                <span className="text-lg font-bold text-emerald-400">{total.toLocaleString('id-ID')}</span>
              </div>
              {canCheckout ? (
                <Link href="/checkout" className="block">
                  <Button className="w-full sm:w-auto min-w-[160px]">Checkout</Button>
                </Link>
              ) : (
                <Button className="w-full sm:w-auto min-w-[160px]" disabled title="Ada item dengan stok tidak cukup">
                  Checkout (stok tidak cukup)
                </Button>
              )}
            </div>
          </div>

          <div className="md:hidden fixed bottom-0 left-0 right-0 z-10 flex items-center justify-between gap-4 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-bfl-bg/95 backdrop-blur border-t border-slate-800/80">
            <div>
              <div className="text-xs text-slate-500">Total</div>
              <div className="text-lg font-bold text-emerald-400">{total.toLocaleString('id-ID')}</div>
              {!canCheckout && <div className="text-[10px] text-red-400">Stok tidak cukup</div>}
            </div>
            {canCheckout ? (
              <Link href="/checkout" className="flex-1 max-w-[200px]">
                <Button className="w-full">Checkout</Button>
              </Link>
            ) : (
              <Button className="flex-1 max-w-[200px]" disabled>Checkout</Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function QuantityControls({ value, max, onChange }: { value: number; max?: number; onChange: (q: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-700/80 bg-slate-900/50 overflow-hidden">
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center text-slate-400 hover:bg-slate-700/60 hover:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Kurangi jumlah"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
      <span className="flex h-9 min-w-10 items-center justify-center text-sm font-medium text-slate-200 tabular-nums">
        {value}
      </span>
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center text-slate-400 hover:bg-slate-700/60 hover:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => onChange(value + 1)}
        disabled={max != null && value >= max}
        aria-label="Tambah jumlah"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
