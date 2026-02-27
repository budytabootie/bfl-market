'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type CatalogItem = { id: string; name: string; category: string };
type Relation = {
  id: string;
  attachment_catalog_id: string;
  weapon_catalog_id: string;
  attachment: { name: string };
  weapon: { name: string };
};

export default function AdminWeaponRelationsPage() {
  const supabase = createClient();
  const [attachments, setAttachments] = useState<CatalogItem[]>([]);
  const [weapons, setWeapons] = useState<CatalogItem[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [attachmentId, setAttachmentId] = useState('');
  const [weaponId, setWeaponId] = useState('');

  async function load() {
    const { data: a } = await supabase.from('catalog').select('id, name, category').eq('category', 'attachment').eq('status', 'active');
    setAttachments((a ?? []) as unknown as CatalogItem[]);

    const { data: w } = await supabase.from('catalog').select('id, name, category').eq('category', 'weapon').eq('status', 'active');
    setWeapons((w ?? []) as unknown as CatalogItem[]);

    const { data: r2 } = await supabase.from('weapon_relations').select('*');
    if (r2) {
      const rels = r2 as { id: string; attachment_catalog_id: string; weapon_catalog_id: string }[];
      const withNames = await Promise.all(
        rels.map(async (rel) => {
          const [{ data: att }, { data: wep }] = await Promise.all([
            supabase.from('catalog').select('name').eq('id', rel.attachment_catalog_id).single(),
            supabase.from('catalog').select('name').eq('id', rel.weapon_catalog_id).single(),
          ]);
          return { ...rel, attachment: att, weapon: wep };
        }),
      );
      setRelations(withNames as unknown as Relation[]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await supabase.from('weapon_relations').insert({
      attachment_catalog_id: attachmentId,
      weapon_catalog_id: weaponId,
    });
    setAttachmentId('');
    setWeaponId('');
    load();
  }

  async function remove(id: string) {
    await supabase.from('weapon_relations').delete().eq('id', id);
    load();
  }

  return (
    <div className="space-y-6">
      <Card title="Weapon Relations (attachment → weapon)">
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3">
          <select
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
            value={attachmentId}
            onChange={(e) => setAttachmentId(e.target.value)}
          >
            <option value="">Attachment</option>
            {attachments.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="flex items-center text-slate-500">→</span>
          <select
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
            value={weaponId}
            onChange={(e) => setWeaponId(e.target.value)}
          >
            <option value="">Weapon</option>
            {weapons.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button type="submit">Tambah</Button>
        </form>
        <div className="mt-4 overflow-x-auto text-xs">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400">
                <th className="p-2 text-left">Attachment</th>
                <th className="p-2 text-left">Weapon</th>
                <th className="p-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {relations.map((rel) => (
                <tr key={rel.id} className="border-t border-slate-800">
                  <td className="p-2">{(rel.attachment as { name?: string })?.name ?? '-'}</td>
                  <td className="p-2">{(rel.weapon as { name?: string })?.name ?? '-'}</td>
                  <td className="p-2">
                    <button type="button" className="text-red-400 hover:text-red-300" onClick={() => remove(rel.id)}>Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
