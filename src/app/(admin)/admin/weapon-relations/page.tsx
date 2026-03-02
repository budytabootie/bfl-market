'use client';

import { useEffect, useState, type FormEvent, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { logActivity } from '@/lib/activity';
import { TableToolbar } from '@/components/ui/TableToolbar';

type CatalogItem = { id: string; name: string; category: string };
type Relation = {
  id: string;
  weapon_catalog_id: string;
  related_catalog_id: string;
  relation_type: string;
  weapon: { name: string };
  related: { name: string; category: string };
};

export default function AdminWeaponRelationsPage() {
  const supabase = createClient();
  const [attachments, setAttachments] = useState<CatalogItem[]>([]);
  const [ammo, setAmmo] = useState<CatalogItem[]>([]);
  const [weapons, setWeapons] = useState<CatalogItem[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [relatedId, setRelatedId] = useState('');
  const [relationType, setRelationType] = useState<'attachment' | 'ammo'>('attachment');
  const [weaponId, setWeaponId] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filteredRelations = useMemo(() => {
    let r = relations;
    const q = search.trim().toLowerCase();
    if (q) {
      r = r.filter((rel) => {
        const w = ((rel.weapon as { name?: string })?.name ?? '').toLowerCase();
        const relName = ((rel.related as { name?: string })?.name ?? '').toLowerCase();
        return w.includes(q) || relName.includes(q);
      });
    }
    if (filterType) r = r.filter((rel) => rel.relation_type === filterType);
    return r;
  }, [relations, search, filterType]);

  const paginatedRelations = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredRelations.slice(from, from + PAGE_SIZE);
  }, [filteredRelations, page]);

  async function load() {
    const { data: a } = await supabase.from('catalog').select('id, name, category').eq('category', 'attachment').eq('status', 'active');
    setAttachments((a ?? []) as unknown as CatalogItem[]);

    const { data: am } = await supabase.from('catalog').select('id, name, category').eq('category', 'ammo').eq('status', 'active');
    setAmmo((am ?? []) as unknown as CatalogItem[]);

    const { data: w } = await supabase.from('catalog').select('id, name, category').eq('category', 'weapon').eq('status', 'active');
    setWeapons((w ?? []) as unknown as CatalogItem[]);

    const { data: r2 } = await supabase.from('weapon_relations').select('*');
    if (r2) {
      const rels = r2 as { id: string; weapon_catalog_id: string; related_catalog_id: string; relation_type: string }[];
      const withNames = await Promise.all(
        rels.map(async (rel) => {
          const [{ data: wep }, { data: relCat }] = await Promise.all([
            supabase.from('catalog').select('name').eq('id', rel.weapon_catalog_id).single(),
            supabase.from('catalog').select('name, category').eq('id', rel.related_catalog_id).single(),
          ]);
          return { ...rel, weapon: wep, related: relCat };
        }),
      );
      setRelations(withNames as unknown as Relation[]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const relatedList = relationType === 'attachment' ? attachments : ammo;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!relatedId || !weaponId) return;
    const weaponName = weapons.find((w) => w.id === weaponId)?.name;
    const relatedName = relatedList.find((r) => r.id === relatedId)?.name;
    const { data } = await supabase.from('weapon_relations').insert({
      weapon_catalog_id: weaponId,
      related_catalog_id: relatedId,
      relation_type: relationType,
    }).select('id').single();
    if (data) await logActivity(supabase, 'weapon_relations.add', 'weapon_relations', (data as { id: string }).id, { weapon_name: weaponName, related_name: relatedName, relation_type: relationType });
    setRelatedId('');
    setWeaponId('');
    load();
  }

  async function remove(id: string) {
    const rel = relations.find((r) => r.id === id);
    await supabase.from('weapon_relations').delete().eq('id', id);
    await logActivity(supabase, 'weapon_relations.delete', 'weapon_relations', id, { weapon_name: (rel?.weapon as { name?: string })?.name, related_name: (rel?.related as { name?: string })?.name });
    load();
  }

  return (
    <div className="space-y-6">
      <Card title="Weapon Relations (attachment / ammo → weapon)">
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-center">
          <select
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
            value={relationType}
            onChange={(e) => { setRelationType(e.target.value as 'attachment' | 'ammo'); setRelatedId(''); }}
          >
            <option value="attachment">Attachment</option>
            <option value="ammo">Ammo</option>
          </select>
          <select
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
            value={relatedId}
            onChange={(e) => setRelatedId(e.target.value)}
          >
            <option value="">Pilih {relationType}</option>
            {relatedList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="text-slate-500">→</span>
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
        <TableToolbar
          searchPlaceholder="Cari weapon atau related…"
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          filters={[
            {
              label: 'Tipe:',
              options: [
                { value: '', label: 'Semua' },
                { value: 'attachment', label: 'Attachment' },
                { value: 'ammo', label: 'Ammo' },
              ],
              value: filterType,
              onChange: (v) => { setFilterType(v); setPage(1); },
            },
          ]}
          totalCount={filteredRelations.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
        <div className="mt-2 overflow-x-auto text-xs">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400">
                <th className="p-2 text-left">Tipe</th>
                <th className="p-2 text-left">Related (Attachment/Ammo)</th>
                <th className="p-2 text-left">Weapon</th>
                <th className="p-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRelations.map((rel) => (
                <tr key={rel.id} className="border-t border-slate-800">
                  <td className="p-2 capitalize">{rel.relation_type}</td>
                  <td className="p-2">{(rel.related as { name?: string })?.name ?? '-'}</td>
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
