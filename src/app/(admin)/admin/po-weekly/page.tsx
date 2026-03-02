'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { logActivity } from '@/lib/activity';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';

type PoProduct = {
  id: string;
  catalog_id: string;
  catalog: { name: string; category: string; base_price: number } | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  ammo: 'Ammo',
  vest: 'Vest',
  attachment: 'Attachment',
  weapon: 'Weapon',
};

function getWeekOptions(startDay = 1, count = 6): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const today = new Date();
  for (let i = -2; i <= count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i * 7);
    const dow = d.getDay();
    const diff = (dow - startDay + 7) % 7;
    d.setDate(d.getDate() - diff);
    const weekStart = d.toISOString().slice(0, 10);
    const weekEnd = new Date(d);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const label = `${weekStart} s/d ${weekEnd.toISOString().slice(0, 10)}`;
    options.push({ value: weekStart, label });
  }
  return options;
}

export default function AdminPoWeeklyPage() {
  const supabase = createClient();
  const [poProducts, setPoProducts] = useState<PoProduct[]>([]);
  const [weekly, setWeekly] = useState<Map<string, { id: string; max_quantity: number | null }>>(new Map());
  const [weekStart, setWeekStart] = useState('');
  const [startDay, setStartDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maxQuantities, setMaxQuantities] = useState<Record<string, string>>({});
  const weekOptions = useMemo(() => getWeekOptions(startDay), [startDay]);

  async function loadCurrentWeek() {
    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'po_week_start_day')
      .single();
    const sd = setting?.value ? parseInt(String(setting.value), 10) : 1;
    if (!isNaN(sd)) setStartDay(sd);

    const { data } = await supabase.rpc('get_current_po_week');
    if (data) {
      setWeekStart(String(data));
    } else {
      const today = new Date();
      const dow = today.getDay();
      const diff = (dow - (isNaN(sd) ? 1 : sd) + 7) % 7;
      today.setDate(today.getDate() - diff);
      setWeekStart(today.toISOString().slice(0, 10));
    }
  }

  async function load() {
    const { data: po } = await supabase
      .from('po_products')
      .select('id, catalog_id, catalog(name, category, base_price)')
      .order('catalog(name)');
    const rows = (po ?? []) as { id: string; catalog_id: string; catalog: { name: string; category: string; base_price: number } | { name: string; category: string; base_price: number }[] | null }[];
    const mapped: PoProduct[] = rows.map((r) => ({
      id: r.id,
      catalog_id: r.catalog_id,
      catalog: Array.isArray(r.catalog) ? (r.catalog[0] ?? null) : r.catalog,
    }));
    setPoProducts(mapped);

    await loadCurrentWeek();
  }

  useEffect(() => {
    if (weekStart) {
      (async () => {
        const { data } = await supabase
          .from('po_weekly_availability')
          .select('id, po_product_id, max_quantity')
          .eq('week_start', weekStart);
        const map = new Map<string, { id: string; max_quantity: number | null }>();
        ((data ?? []) as { id: string; po_product_id: string; max_quantity: number | null }[]).forEach((r) => {
          map.set(r.po_product_id, { id: r.id, max_quantity: r.max_quantity });
        });
        setWeekly(map);
        const qty: Record<string, string> = {};
        map.forEach((v, k) => {
          qty[k] = v.max_quantity != null ? String(v.max_quantity) : '';
        });
        setMaxQuantities(qty);
      })();
    }
  }, [weekStart, supabase]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const selectedForWeek = useMemo(() => {
    const set = new Set<string>();
    weekly.forEach((_, poProductId) => set.add(poProductId));
    return set;
  }, [weekly]);

  async function toggleProduct(poProductId: string) {
    if (!weekStart) return;
    const isSelected = selectedForWeek.has(poProductId);
    const pp = poProducts.find((p) => p.id === poProductId);
    const itemName = pp?.catalog?.name;
    if (isSelected) {
      const rec = weekly.get(poProductId);
      if (rec) {
        await supabase.from('po_weekly_availability').delete().eq('id', rec.id);
        await logActivity(supabase, 'po_weekly.toggle_off', 'po_weekly_availability', rec.id, { week_start: weekStart, item_name: itemName });
        setWeekly((prev) => {
          const n = new Map(prev);
          n.delete(poProductId);
          return n;
        });
        setMaxQuantities((prev) => {
          const next = { ...prev };
          delete next[poProductId];
          return next;
        });
      }
    } else {
      const maxVal = maxQuantities[poProductId];
      const maxQty = maxVal === '' || maxVal === undefined ? null : Math.max(0, parseInt(maxVal, 10) || 0);
      const { data } = await supabase
        .from('po_weekly_availability')
        .insert({ po_product_id: poProductId, week_start: weekStart, max_quantity: maxQty })
        .select('id')
        .single();
      if (data) {
        setWeekly((prev) => new Map(prev).set(poProductId, { id: (data as { id: string }).id, max_quantity: maxQty }));
        await logActivity(supabase, 'po_weekly.toggle_on', 'po_weekly_availability', (data as { id: string }).id, { week_start: weekStart, max_quantity: maxQty, item_name: itemName });
      }
    }
  }

  async function handleSave() {
    if (!weekStart) return;
    setSaving(true);
    for (const [poProductId, rec] of weekly) {
      const maxVal = maxQuantities[poProductId];
      const maxQty = maxVal === '' || maxVal === undefined ? null : Math.max(0, parseInt(maxVal, 10) || 0);
      const pp = poProducts.find((p) => p.id === poProductId);
      await supabase
        .from('po_weekly_availability')
        .update({ max_quantity: maxQty })
        .eq('id', rec.id);
      await logActivity(supabase, 'po_weekly.save_max_qty', 'po_weekly_availability', rec.id, { week_start: weekStart, max_quantity: maxQty, item_name: pp?.catalog?.name });
    }
    setSaving(false);
  }

  async function setProductMaxQty(poProductId: string, value: string) {
    setMaxQuantities((prev) => ({ ...prev, [poProductId]: value }));
  }

  if (loading) return <Card title="Jatah Mingguan"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">Jatah Mingguan</h1>
          <p className="text-sm text-slate-400 mt-0.5">Centang produk yang ready untuk PO di minggu terpilih. Kosongkan max quantity untuk unlimited.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/po-products">
            <Button variant="secondary">Produk PO</Button>
          </Link>
          <Link href="/admin/po-settings">
            <Button variant="secondary">Settings</Button>
          </Link>
        </div>
      </div>

      <Card title="Pilih Minggu">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <label className="form-label">Minggu</label>
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-bfl-primary focus:ring-1 focus:ring-bfl-primary"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            >
              {weekOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card title="Produk Ready untuk PO">
        {poProducts.length === 0 ? (
          <p className="text-slate-500 py-4">Belum ada produk PO. Tambah dulu di <Link href="/admin/po-products" className="text-bfl-primary hover:underline">Produk PO</Link>.</p>
        ) : (
          <>
            <div className="overflow-x-auto text-xs">
              <table className="w-full">
                <thead>
                  <tr className="text-slate-400">
                    <th className="p-2 text-left w-10">Ready</th>
                    <th className="p-2 text-left">Nama</th>
                    <th className="p-2 text-left">Category</th>
                    <th className="p-2 text-right">Harga</th>
                    <th className="p-2 text-right w-28">Max Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {poProducts.map((pp) => {
                    const cat = pp.catalog;
                    const isSelected = selectedForWeek.has(pp.id);
                    return (
                      <tr key={pp.id} className="border-t border-slate-800">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleProduct(pp.id)}
                            className="rounded border-slate-600 bg-slate-800 text-bfl-primary focus:ring-bfl-primary"
                          />
                        </td>
                        <td className="p-2">{cat?.name ?? '-'}</td>
                        <td className="p-2">{cat ? (CATEGORY_LABELS[cat.category] ?? cat.category) : '-'}</td>
                        <td className="p-2 text-right">{cat ? Number(cat.base_price).toLocaleString('id-ID') : '-'}</td>
                        <td className="p-2">
                          {isSelected ? (
                            <Input
                              type="number"
                              min={0}
                              placeholder="Unlimited"
                              value={maxQuantities[pp.id] ?? (weekly.get(pp.id)?.max_quantity != null ? String(weekly.get(pp.id)!.max_quantity) : '')}
                              onChange={(e) => setProductMaxQty(pp.id, e.target.value)}
                              className="text-right w-20"
                            />
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Menyimpan…' : 'Simpan Max Quantity'}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
