'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { logActivity } from '@/lib/activity';
import { Select } from '@/components/ui/Select';
import Link from 'next/link';

const WEEK_DAYS = [
  { value: '0', label: 'Minggu' },
  { value: '1', label: 'Senin' },
  { value: '2', label: 'Selasa' },
  { value: '3', label: 'Rabu' },
  { value: '4', label: 'Kamis' },
  { value: '5', label: 'Jumat' },
  { value: '6', label: 'Sabtu' },
];

export default function AdminPoSettingsPage() {
  const supabase = createClient();
  const [weekStartDay, setWeekStartDay] = useState('1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'po_week_start_day')
        .single();
      if (data?.value) setWeekStartDay(data.value);
    })().finally(() => setLoading(false));
  }, [supabase]);

  async function handleSave() {
    setSaving(true);
    await supabase.from('app_settings').upsert(
      { key: 'po_week_start_day', value: weekStartDay, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    await logActivity(supabase, 'po_settings.save_week_start', 'app_settings', 'po_week_start_day', { week_start_day: weekStartDay });
    setSaving(false);
  }

  if (loading) return <Card title="PO Settings"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/po-products">
          <Button variant="secondary">← Produk PO</Button>
        </Link>
        <Link href="/admin/po-weekly">
          <Button variant="secondary">Jatah Mingguan</Button>
        </Link>
      </div>

      <Card title="Pengaturan PO">
        <p className="text-sm text-slate-400 mb-4">
          Minggu dimulai dari hari apa untuk perhitungan jatah mingguan. Contoh: jika Senin, maka minggu berjalan adalah Senin–Minggu.
        </p>
        <div className="flex items-end gap-4 max-w-xs">
          <div className="flex-1">
            <label className="form-label">Minggu mulai hari</label>
            <Select value={weekStartDay} onChange={(e) => setWeekStartDay(e.target.value)}>
              {WEEK_DAYS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </Select>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
