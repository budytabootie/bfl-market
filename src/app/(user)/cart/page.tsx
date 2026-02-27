'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type CartItem = { id: string; name: string; category: string; base_price: number; quantity: number };

export default function CartPage() {
  const searchParams = useSearchParams();
  const addId = searchParams.get('add');
  const supabase = createClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('bfl-cart') : null;
    const ids = stored ? JSON.parse(stored) as { id: string; qty: number }[] : [];
    if (addId) {
      const existing = ids.find((x) => x.id === addId);
      if (existing) existing.qty += 1;
      else ids.push({ id: addId, qty: 1 });
      localStorage.setItem('bfl-cart', JSON.stringify(ids));
      window.history.replaceState({}, '', '/cart');
    }
    if (ids.length === 0) {
      setCart([]);
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const { data } = await supabase.from('catalog').select('id, name, category, base_price').in('id', ids.map((x) => x.id));
        const items = (data ?? []) as { id: string; name: string; category: string; base_price: number }[];
        setCart(ids.map((x) => {
          const item = items.find((i) => i.id === x.id);
          return item ? { ...item, quantity: x.qty } : null;
        }).filter(Boolean) as CartItem[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, addId]);

  const total = useMemo(() => cart.reduce((s, i) => s + Number(i.base_price) * i.quantity, 0), [cart]);

  function updateQty(id: string, qty: number) {
    const next = cart.map((c) => (c.id === id ? { ...c, quantity: Math.max(0, qty) } : c)).filter((c) => c.quantity > 0);
    setCart(next);
    const stored = next.map((c) => ({ id: c.id, qty: c.quantity }));
    localStorage.setItem('bfl-cart', JSON.stringify(stored));
  }

  if (loading) return <Card title="Cart"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-bfl-card/60 to-slate-950/60 p-5">
        <h1 className="text-xl font-semibold text-slate-50">Keranjang</h1>
        <p className="mt-1 text-sm text-slate-400">Review item dan lanjut checkout jika sudah sesuai.</p>
      </div>
      <Card title="Cart">
        {cart.length === 0 ? (
          <p className="text-slate-400">Cart kosong. <Link href="/marketplace" className="text-bfl-primary hover:underline">Belanja</Link></p>
        ) : (
          <>
            <div className="overflow-x-auto text-xs">
              <table className="w-full">
                <thead>
                  <tr className="text-slate-400">
                    <th className="p-2 text-left">Item</th>
                    <th className="p-2 text-right">Harga</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Subtotal</th>
                    <th className="p-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((c) => (
                    <tr key={c.id} className="border-t border-slate-800">
                      <td className="p-2">{c.name}</td>
                      <td className="p-2 text-right">{Number(c.base_price).toLocaleString('id-ID')}</td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min={1}
                          className="w-14 rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-center text-xs"
                          value={c.quantity}
                          onChange={(e) => updateQty(c.id, Number(e.target.value))}
                        />
                      </td>
                      <td className="p-2 text-right">{(Number(c.base_price) * c.quantity).toLocaleString('id-ID')}</td>
                      <td className="p-2"><button type="button" className="text-red-400" onClick={() => updateQty(c.id, 0)}>Hapus</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-between items-center">
              <span className="text-slate-400">Total: <span className="font-semibold text-emerald-400">{total.toLocaleString('id-ID')}</span></span>
              <Link href="/checkout"><Button>Checkout</Button></Link>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
