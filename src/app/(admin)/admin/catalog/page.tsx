'use client';

import { useEffect, useState, type FormEvent, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { logActivity } from '@/lib/activity';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ImageUploadInput } from '@/components/ui/ImageUploadInput';
import { TableToolbar } from '@/components/ui/TableToolbar';

type CatalogRow = {
  id: string;
  name: string;
  category: string;
  base_price: number;
  status: string;
  image_url: string | null;
};

const CATEGORIES = ['ammo', 'vest', 'attachment', 'weapon', 'barham'] as const;
const STATUSES = ['active', 'inactive'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  ammo: 'Ammo',
  vest: 'Vest',
  attachment: 'Attachment',
  weapon: 'Weapon',
  barham: 'Barham',
};

export default function AdminCatalogPage() {
  const supabase = createClient();
  const [items, setItems] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('barham');
  const [basePrice, setBasePrice] = useState(0);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('active');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const createImageRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<(typeof CATEGORIES)[number]>('ammo');
  const [editBasePrice, setEditBasePrice] = useState(0);
  const [editStatus, setEditStatus] = useState<(typeof STATUSES)[number]>('active');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const editImageRef = useRef<HTMLInputElement>(null);

  async function load() {
    setError(null);
    const { data, error: err } = await supabase.from('catalog').select('*').order('name');
    if (err) {
      setError(err.message);
      setItems([]);
    } else {
      setItems((data ?? []) as CatalogRow[]);
    }
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const categoryCounts = CATEGORIES.reduce((acc, c) => {
    acc[c] = items.filter((i) => i.category === c).length;
    return acc;
  }, {} as Record<string, number>);

  const filteredItems = useMemo(() => {
    let r = items;
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((i) => i.name.toLowerCase().includes(q));
    if (filterCategory) r = r.filter((i) => i.category === filterCategory);
    if (filterStatus) r = r.filter((i) => i.status === filterStatus);
    return r;
  }, [items, search, filterCategory, filterStatus]);

  const paginatedItems = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(from, from + PAGE_SIZE);
  }, [filteredItems, page]);

  async function uploadImage(catalogId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
    const path = `${catalogId}-${Date.now()}.${safeExt}`;
    const { error: uploadErr } = await supabase.storage.from('catalog-images').upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || `image/${safeExt}`,
    });
    if (uploadErr) {
      const msg = uploadErr.message || JSON.stringify(uploadErr);
      throw new Error(msg);
    }
    const { data } = supabase.storage.from('catalog-images').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const { data: inserted, error: insertErr } = await supabase
      .from('catalog')
      .insert({ name, category, base_price: basePrice, status })
      .select('id')
      .single();
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    const id = (inserted as { id: string }).id;
    if (imageFile) {
      try {
        const url = await uploadImage(id, imageFile);
        await supabase.from('catalog').update({ image_url: url }).eq('id', id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload gambar gagal';
        setError(`Upload gambar: ${msg}. Pastikan bucket "catalog-images" sudah dibuat di Supabase Dashboard > Storage.`);
      }
    }
    await logActivity(supabase, 'catalog.create', 'catalog', id, { name, category });
    setName('');
    setBasePrice(0);
    setStatus('active');
    setImageFile(null);
    if (createImageRef.current) createImageRef.current.value = '';
    load();
  }

  function openEdit(r: CatalogRow) {
    setEditing(r);
    setEditName(r.name);
    setEditCategory(r.category as (typeof CATEGORIES)[number]);
    setEditBasePrice(Number(r.base_price));
    setEditStatus(r.status as (typeof STATUSES)[number]);
    setEditImageFile(null);
    if (editImageRef.current) editImageRef.current.value = '';
    setError(null);
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    let imageUrl = editing.image_url;
    if (editImageFile) {
      try {
        imageUrl = await uploadImage(editing.id, editImageFile);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload gambar gagal';
        setError(`Upload gambar: ${msg}. Pastikan bucket "catalog-images" sudah dibuat di Supabase Dashboard > Storage.`);
        return;
      }
    }
    const { error: updateErr } = await supabase
      .from('catalog')
      .update({
        name: editName,
        category: editCategory,
        base_price: editBasePrice,
        status: editStatus,
        image_url: imageUrl,
      })
      .eq('id', editing.id);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    await logActivity(supabase, 'catalog.update', 'catalog', editing.id, { name: editName, category: editCategory });
    setEditing(null);
    load();
  }

  async function handleDelete(r: CatalogRow) {
    if (!confirm(`Hapus "${r.name}"? Item yang pernah dipakai di order tidak bisa dihapus.`)) return;
    setError(null);
    const { count } = await supabase
      .from('order_items')
      .select('*', { count: 'exact', head: true })
      .eq('catalog_id', r.id);
    if ((count ?? 0) > 0) {
      setError('Item ini sudah dipakai di order, tidak bisa dihapus');
      return;
    }
    const { error: delErr } = await supabase.from('catalog').delete().eq('id', r.id);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    await logActivity(supabase, 'catalog.delete', 'catalog', r.id, { name: r.name });
    load();
  }

  async function toggleStatus(id: string, s: string) {
    const newStatus = s === 'active' ? 'inactive' : 'active';
    await supabase.from('catalog').update({ status: newStatus }).eq('id', id);
    await logActivity(supabase, 'catalog.toggle_status', 'catalog', id, { status: newStatus });
    load();
  }

  if (loading) return <Card title="Katalog"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error}</div>
      )}

      <Card title="Summary per Category">
        <div className="flex flex-wrap gap-4">
          {CATEGORIES.map((c) => (
            <div key={c} className="rounded-xl border border-slate-700/60 bg-slate-800/30 px-5 py-4 ring-1 ring-slate-700/20">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{CATEGORY_LABELS[c] ?? c}</span>
              <p className="mt-1 text-2xl font-bold text-slate-100">{categoryCounts[c] ?? 0}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Tambah Barang">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
          <div className="min-w-[140px]">
            <label className="form-label">Nama</label>
            <Input placeholder="Nama barang" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="min-w-[120px]">
            <label className="form-label">Category</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
            </Select>
          </div>
          <div className="min-w-[100px]">
            <label className="form-label">Harga</label>
            <Input type="number" placeholder="0" value={basePrice || ''} onChange={(e) => setBasePrice(Number(e.target.value))} />
          </div>
          <div className="min-w-[100px]">
            <label className="form-label">Status</label>
            <Select value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <div className="min-w-[200px]">
            <label className="form-label">Gambar (opsional)</label>
            <ImageUploadInput
              inputRef={createImageRef}
              value={imageFile}
              onChange={setImageFile}
              accept="image/*"
            />
          </div>
          <Button type="submit">Tambah</Button>
        </form>
      </Card>

      <Card title="Daftar Barang">
        <TableToolbar
          searchPlaceholder="Cari nama barang…"
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          filters={[
            {
              label: 'Kategori:',
              options: [{ value: '', label: 'Semua' }, ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] ?? c }))],
              value: filterCategory,
              onChange: (v) => { setFilterCategory(v); setPage(1); },
            },
            {
              label: 'Status:',
              options: [{ value: '', label: 'Semua' }, ...STATUSES.map((s) => ({ value: s, label: s }))],
              value: filterStatus,
              onChange: (v) => { setFilterStatus(v); setPage(1); },
            },
          ]}
          totalCount={filteredItems.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
        <div className="overflow-x-auto text-xs">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400">
                <th className="p-2 text-left">Gambar</th>
                <th className="p-2 text-left">Nama</th>
                <th className="p-2 text-left">Category</th>
                <th className="p-2 text-right">Harga</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((r) => (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="p-2">
                    {r.image_url ? (
                      <img src={r.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-500">-</div>
                    )}
                  </td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{CATEGORY_LABELS[r.category] ?? r.category}</td>
                  <td className="p-2 text-right">{Number(r.base_price).toLocaleString('id-ID')}</td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${r.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30' : 'bg-slate-700/80 text-slate-400'}`}
                      onClick={() => toggleStatus(r.id, r.status)}
                    >
                      {r.status}
                    </button>
                  </td>
                  <td className="p-2">
                    <button type="button" className="text-bfl-primary hover:underline mr-2" onClick={() => openEdit(r)}>Edit</button>
                    <button type="button" className="text-red-400 hover:underline" onClick={() => handleDelete(r)}>Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
            <Card title="Edit Barang" className="w-full">
              <form onSubmit={handleEdit} className="space-y-4">
                {editing.image_url && (
                  <div>
                    <label className="form-label">Gambar saat ini</label>
                    <img src={editing.image_url} alt="" className="mt-2 h-20 w-20 rounded-xl object-cover ring-1 ring-slate-700/50" />
                  </div>
                )}
                <div>
                  <label className="form-label">Ganti gambar (opsional)</label>
                  <ImageUploadInput
                    inputRef={editImageRef}
                    value={editImageFile}
                    onChange={setEditImageFile}
                    accept="image/*"
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="form-label">Nama</label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Category</label>
                  <Select value={editCategory} onChange={(e) => setEditCategory(e.target.value as (typeof CATEGORIES)[number])}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="form-label">Harga</label>
                  <Input type="number" value={editBasePrice || ''} onChange={(e) => setEditBasePrice(Number(e.target.value))} required />
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <Select value={editStatus} onChange={(e) => setEditStatus(e.target.value as (typeof STATUSES)[number])}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit">Simpan</Button>
                  <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Batal</Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
