'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type CartItem = { id: string; name: string; base_price: number; quantity: number; isPo: boolean };

export default function CheckoutPage() {
  const router = useRouter();
  const supabase = createClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('bfl-cart') : null;
    const entries = stored ? JSON.parse(stored) as { id: string; qty: number; isPo?: boolean }[] : [];
    if (entries.length === 0) {
      setCart([]);
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const { data } = await supabase.from('catalog').select('id, name, base_price').in('id', entries.map((x) => x.id));
        const catalogItems = (data ?? []) as { id: string; name: string; base_price: number }[];
        setCart(entries.map((x) => {
          const item = catalogItems.find((i) => i.id === x.id);
          return item ? { ...item, quantity: x.qty, isPo: Boolean(x.isPo) } : null;
        }).filter(Boolean) as CartItem[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const total = cart.reduce((s, i) => s + Number(i.base_price) * i.quantity, 0);

  async function handleCheckout() {
    if (cart.length === 0) return;
    setSubmitting(true);
    setError(null);

    const poIds = cart.filter((c) => c.isPo).map((c) => c.id);
    if (poIds.length > 0) {
      const { data: weekStart } = await supabase.rpc('get_current_po_week');
      if (weekStart) {
        const { data: weekly } = await supabase
          .from('po_weekly_availability')
          .select('po_product_id')
          .eq('week_start', String(weekStart));
        const poProductIds = ((weekly ?? []) as { po_product_id: string }[]).map((w) => w.po_product_id);
        let validCatalogIds = new Set<string>();
        if (poProductIds.length > 0) {
          const { data: po } = await supabase
            .from('po_products')
            .select('catalog_id')
            .in('id', poProductIds);
          ((po ?? []) as { catalog_id: string }[]).forEach((p) => validCatalogIds.add(p.catalog_id));
        }
        const invalid = poIds.filter((id) => !validCatalogIds.has(id));
        if (invalid.length > 0) {
          setError('Beberapa item PO sudah tidak tersedia untuk minggu ini. Silakan hapus dari cart dan coba lagi.');
          setSubmitting(false);
          return;
        }
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Session expired');
      setSubmitting(false);
      return;
    }
    const { data: profile } = await supabase.from('users').select('id').eq('id', user.id).single();
    if (!profile) {
      setError('User profile not found');
      setSubmitting(false);
      return;
    }
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({ user_id: profile.id, status: 'pending' })
      .select('id')
      .single();
    if (orderErr || !order) {
      setError(orderErr?.message ?? 'Failed to create order');
      setSubmitting(false);
      return;
    }
    const items = cart.map((c) => ({
      order_id: order.id,
      catalog_id: c.id,
      quantity: c.quantity,
      price_each: c.base_price,
      subtotal: c.base_price * c.quantity,
      status: 'pending',
      is_po: c.isPo,
    }));
    const { error: itemsErr } = await supabase.from('order_items').insert(items);
    if (itemsErr) {
      setError(itemsErr.message);
      setSubmitting(false);
      return;
    }
    localStorage.removeItem('bfl-cart');
    router.push('/orders');
    router.refresh();
  }

  if (loading) return <Card title="Checkout"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800/80 bg-linear-to-br from-bfl-card/60 to-slate-950/60 p-5">
        <h1 className="text-xl font-semibold text-slate-50">Checkout</h1>
        <p className="mt-1 text-sm text-slate-400">Pastikan item sudah benar, lalu konfirmasi order. Admin akan memproses permintaan Anda.</p>
      </div>
    <Card title="Checkout">
      {cart.length === 0 ? (
        <p className="text-slate-400">
          Cart kosong.{' '}
          <Link href="/marketplace" className="text-bfl-primary hover:underline">Belanja di Marketplace</Link>
        </p>
      ) : (
        <>
          <div className="space-y-2 text-sm">
            {cart.map((c) => (
              <div key={c.id} className="flex justify-between items-center">
                <span>
                  {c.name} x{c.quantity}
                  {c.isPo && <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">PO</span>}
                </span>
                <span>{(Number(c.base_price) * c.quantity).toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between items-center border-t border-slate-800 pt-4">
            <span className="font-semibold text-emerald-400">Total: {total.toLocaleString('id-ID')}</span>
            <Button onClick={handleCheckout} disabled={submitting}>{submitting ? 'Processing…' : 'Confirm Order'}</Button>
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </>
      )}
    </Card>
    </div>
  );
}
