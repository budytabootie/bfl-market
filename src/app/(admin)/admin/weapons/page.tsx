'use client';

import { useEffect, useState, type FormEvent, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { logActivity } from '@/lib/activity';
import { TableToolbar } from '@/components/ui/TableToolbar';

type CatalogWeapon = { id: string; name: string };
type UserOption = { id: string; username: string; name: string };
type WarehouseWeapon = {
  id: string;
  catalog_id: string;
  serial_number: string;
  status: string;
  owner_id: string | null;
  catalog: { name: string };
  users: { username: string } | null;
};

const STATUSES = ['available', 'in_use', 'broken', 'lost', 'confiscated'] as const;
/** Cap rows loaded; filter/search tetap di client pada dataset ini. */
const FETCH_LIMIT = 2500;
const PAGE_SIZE = 20;

export default function AdminWeaponsPage() {
  const supabase = createClient();
  const [catalog, setCatalog] = useState<CatalogWeapon[]>([]);
  const [weapons, setWeapons] = useState<WarehouseWeapon[]>([]);
  const [catalogId, setCatalogId] = useState('');
  const [serial, setSerial] = useState('');
  const [status, setStatus] = useState<typeof STATUSES[number]>('available');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCatalogId, setFilterCatalogId] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [editSn, setEditSn] = useState<{ id: string; serial_number: string; name: string } | null>(null);
  const [editSnValue, setEditSnValue] = useState('');
  const [editSnLoading, setEditSnLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [ownerModal, setOwnerModal] = useState<{ id: string; weaponName: string; currentOwnerId: string | null } | null>(null);
  const [usersList, setUsersList] = useState<UserOption[]>([]);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [addOwnerPickerOpen, setAddOwnerPickerOpen] = useState(false);
  const [selectedOwnerForAdd, setSelectedOwnerForAdd] = useState<{ id: string; username: string } | null>(null);
  const [weaponsTruncated, setWeaponsTruncated] = useState(false);

  const filteredWeapons = useMemo(() => {
    let r = weapons;
    const q = search.trim().toLowerCase();
    if (q) {
      r = r.filter((w) => {
        const catName = ((w.catalog as { name?: string })?.name ?? '').toLowerCase();
        const sn = (w.serial_number ?? '').toLowerCase();
        return catName.includes(q) || sn.includes(q);
      });
    }
    if (filterStatus) r = r.filter((w) => w.status === filterStatus);
    if (filterCatalogId) r = r.filter((w) => w.catalog_id === filterCatalogId);
    return r;
  }, [weapons, search, filterStatus, filterCatalogId]);

  const paginatedWeapons = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredWeapons.slice(from, from + PAGE_SIZE);
  }, [filteredWeapons, page]);

  async function load() {
    setError(null);
    const { data: c } = await supabase.from('catalog').select('id, name').eq('category', 'weapon').eq('status', 'active').order('name');
    setCatalog((c ?? []) as unknown as CatalogWeapon[]);

    const { data: w, error: wErr } = await supabase
      .from('warehouse_weapons')
      .select('id, catalog_id, serial_number, status, owner_id, catalog(name), users(username)')
      .order('serial_number')
      .limit(FETCH_LIMIT);
    if (wErr) {
      setError(`Gagal load: ${wErr.message}`);
      setWeapons([]);
      setWeaponsTruncated(false);
      return;
    }
    const rows = (w ?? []) as unknown as WarehouseWeapon[];
    setWeapons(rows);
    setWeaponsTruncated(rows.length >= FETCH_LIMIT);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const catalogItem = catalog.find((c) => c.id === catalogId);
    const { data, error: insErr } = await supabase
      .from('warehouse_weapons')
      .insert({
        catalog_id: catalogId,
        serial_number: serial.trim(),
        status,
        owner_id: selectedOwnerForAdd?.id ?? null,
      })
      .select('id')
      .single();
    if (insErr) {
      setError(insErr.code === '23505' ? 'Serial number sudah ada' : insErr.message);
      return;
    }
    if (data) await logActivity(supabase, 'weapons.add', 'warehouse_weapons', (data as { id: string }).id, { catalog_id: catalogId, serial_number: serial, item_name: catalogItem?.name, owner_id: selectedOwnerForAdd?.id, owner_username: selectedOwnerForAdd?.username });
    setSerial('');
    setSelectedOwnerForAdd(null);
    load();
  }

  async function updateStatus(id: string, s: string) {
    const item = weapons.find((w) => w.id === id);
    await supabase.from('warehouse_weapons').update({ status: s }).eq('id', id);
    await logActivity(supabase, 'weapons.update_status', 'warehouse_weapons', id, { status: s, item_name: (item?.catalog as { name?: string })?.name });
    load();
  }

  function openEditSn(w: WarehouseWeapon) {
    setEditSn({ id: w.id, serial_number: w.serial_number, name: (w.catalog as { name?: string })?.name ?? 'Weapon' });
    setEditSnValue(w.serial_number);
  }

  async function saveEditSn() {
    if (!editSn || !editSnValue.trim()) return;
    setEditSnLoading(true);
    setError(null);
    try {
      const { error: upErr } = await supabase.from('warehouse_weapons').update({ serial_number: editSnValue.trim() }).eq('id', editSn.id);
      if (upErr) throw new Error(upErr.code === '23505' ? 'Serial number sudah dipakai' : upErr.message);
      await logActivity(supabase, 'weapons.edit_sn', 'warehouse_weapons', editSn.id, { old: editSn.serial_number, new: editSnValue.trim(), item_name: editSn.name });
      setEditSn(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal update SN');
    } finally {
      setEditSnLoading(false);
    }
  }

  async function deleteWeapon() {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    setError(null);
    try {
      const { error: delErr } = await supabase.from('warehouse_weapons').delete().eq('id', deleteConfirm.id);
      if (delErr) throw new Error(delErr.code === '23503' ? 'Weapon ini terhubung ke order, tidak bisa dihapus' : delErr.message);
      await logActivity(supabase, 'weapons.delete', 'warehouse_weapons', deleteConfirm.id, { item_name: deleteConfirm.name });
      setDeleteConfirm(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal hapus');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function openOwnerModal(w: WarehouseWeapon) {
    setOwnerModal({ id: w.id, weaponName: (w.catalog as { name?: string })?.name ?? w.serial_number, currentOwnerId: w.owner_id ?? null });
    setOwnerSearch('');
    setSelectedOwnerId(w.owner_id ?? null);
    const { data: u } = await supabase.from('users').select('id, username, name').order('username');
    setUsersList((u ?? []) as UserOption[]);
  }

  async function openAddOwnerPicker() {
    setAddOwnerPickerOpen(true);
    setOwnerSearch('');
    const { data: u } = await supabase.from('users').select('id, username, name').order('username');
    setUsersList((u ?? []) as UserOption[]);
  }

  function selectOwnerForAdd(user: UserOption | null) {
    setSelectedOwnerForAdd(user ? { id: user.id, username: user.username } : null);
    setAddOwnerPickerOpen(false);
  }

  const filteredUsersForOwner = useMemo(() => {
    const q = ownerSearch.trim().toLowerCase();
    if (!q) return usersList;
    return usersList.filter((u) => (u.username ?? '').toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q));
  }, [usersList, ownerSearch]);

  async function saveOwner() {
    if (!ownerModal) return;
    setOwnerLoading(true);
    setError(null);
    try {
      await supabase.from('warehouse_weapons').update({ owner_id: selectedOwnerId }).eq('id', ownerModal.id);
      const label = selectedOwnerId ? usersList.find((u) => u.id === selectedOwnerId)?.username ?? selectedOwnerId : '(lepas)';
      await logActivity(supabase, 'weapons.change_owner', 'warehouse_weapons', ownerModal.id, { weapon_name: ownerModal.weaponName, new_owner: label });
      setOwnerModal(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal ubah owner');
    } finally {
      setOwnerLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      )}
      <Card title="Tambah Weapon">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <select
              className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
              value={catalogId}
              onChange={(e) => setCatalogId(e.target.value)}
            >
              <option value="">Pilih weapon</option>
              {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input
              className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
              placeholder="Serial Number"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              required
            />
            <select
              className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof STATUSES[number])}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Button type="submit">Tambah</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Owner (opsional):</span>
            {selectedOwnerForAdd ? (
              <>
                <span className="text-slate-200 font-medium">{selectedOwnerForAdd.username}</span>
                <Button type="button" variant="secondary" className="py-1! px-2! min-h-0! text-xs" onClick={openAddOwnerPicker}>Ubah</Button>
                <Button type="button" variant="secondary" className="py-1! px-2! min-h-0! text-xs" onClick={() => setSelectedOwnerForAdd(null)}>Lepas</Button>
              </>
            ) : (
              <Button type="button" variant="secondary" className="py-1! px-2! min-h-0! text-xs" onClick={openAddOwnerPicker}>Pilih owner</Button>
            )}
          </div>
        </form>
      </Card>
      <Card title="Daftar Weapons">
        {weaponsTruncated && (
          <p className="mb-3 text-xs text-amber-200/90 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            Memuat hingga {FETCH_LIMIT.toLocaleString('id-ID')} baris pertama (urut serial). Senjata di luar batas ini tidak muncul di daftar sampai pagination server ditambahkan.
          </p>
        )}
        <TableToolbar
          searchPlaceholder="Cari nama senjata atau SN…"
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          filters={[
            {
              label: 'Nama senjata:',
              options: [
                { value: '', label: 'Semua' },
                ...catalog.map((c) => ({ value: c.id, label: c.name })),
              ],
              value: filterCatalogId,
              onChange: (v) => { setFilterCatalogId(v); setPage(1); },
            },
            {
              label: 'Status:',
              options: [
                { value: '', label: 'Semua' },
                ...STATUSES.map((s) => ({ value: s, label: s })),
              ],
              value: filterStatus,
              onChange: (v) => { setFilterStatus(v); setPage(1); },
            },
          ]}
          totalCount={filteredWeapons.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
        <div className="overflow-x-auto text-xs mt-2">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400">
                <th className="p-2 text-left">Barang</th>
                <th className="p-2 text-left">Serial</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Owner</th>
                <th className="p-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedWeapons.map((r) => (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="p-2">{(r.catalog as { name?: string })?.name ?? '-'}</td>
                  <td className="p-2 font-mono">{r.serial_number}</td>
                  <td className="p-2">
                    <select
                      className="rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[11px]"
                      value={r.status}
                      onChange={(e) => updateStatus(r.id, e.target.value)}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="p-2">{(r.users as { username?: string })?.username ?? '-'}</td>
                  <td className="p-2">
                    <div className="flex gap-1.5 flex-wrap">
                      <Button type="button" variant="secondary" className="py-1! px-2! min-h-0! text-[11px]" onClick={() => openOwnerModal(r)}>Ubah Owner</Button>
                      <Button type="button" variant="secondary" className="py-1! px-2! min-h-0! text-[11px]" onClick={() => openEditSn(r)}>Edit SN</Button>
                      <Button type="button" variant="danger" className="py-1! px-2! min-h-0! text-[11px]" onClick={() => setDeleteConfirm({ id: r.id, name: (r.catalog as { name?: string })?.name ?? r.serial_number })}>Hapus</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredWeapons.length === 0 && (
          <p className="py-6 text-center text-slate-500 text-sm">Tidak ada data. Ubah filter atau cari.</p>
        )}
      </Card>

      {editSn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !editSnLoading && setEditSn(null)}>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">Edit Serial Number</h3>
            <p className="text-sm text-slate-400 mt-1">{editSn.name}</p>
            <input
              className="mt-3 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200"
              value={editSnValue}
              onChange={(e) => setEditSnValue(e.target.value)}
              placeholder="Serial Number"
              disabled={editSnLoading}
            />
            <div className="mt-4 flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setEditSn(null)} disabled={editSnLoading}>Batal</Button>
              <Button variant="primary" onClick={saveEditSn} disabled={editSnLoading || !editSnValue.trim()}>{editSnLoading ? 'Menyimpan…' : 'Simpan'}</Button>
            </div>
          </div>
        </div>
      )}

      {addOwnerPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setAddOwnerPickerOpen(false)}>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 shadow-xl w-full max-w-md p-5 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">Pilih owner (untuk weapon baru)</h3>
            <p className="text-sm text-slate-400 mt-1">Opsional. Klik user untuk memilih.</p>
            <input
              type="text"
              className="mt-3 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200 text-sm"
              placeholder="Cari username atau nama…"
              value={ownerSearch}
              onChange={(e) => setOwnerSearch(e.target.value)}
            />
            <div className="mt-2 flex-1 min-h-0 overflow-y-auto border border-slate-700 rounded-lg bg-slate-800/50">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm border-b border-slate-700 hover:bg-slate-700/50 text-slate-300"
                onClick={() => selectOwnerForAdd(null)}
              >
                — Lepas owner (tanpa owner)
              </button>
              {filteredUsersForOwner.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm border-b border-slate-700/80 hover:bg-slate-700/50 text-slate-300"
                  onClick={() => selectOwnerForAdd(u)}
                >
                  <span className="font-medium">{u.username}</span>
                  {u.name && u.name !== u.username && <span className="text-slate-400 ml-2">{u.name}</span>}
                </button>
              ))}
              {filteredUsersForOwner.length === 0 && ownerSearch.trim() && <p className="px-3 py-4 text-slate-500 text-sm">Tidak ada user cocok.</p>}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setAddOwnerPickerOpen(false)}>Batal</Button>
            </div>
          </div>
        </div>
      )}

      {ownerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !ownerLoading && setOwnerModal(null)}>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 shadow-xl w-full max-w-md p-5 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">Ubah Owner</h3>
            <p className="text-sm text-slate-400 mt-1">{ownerModal.weaponName}</p>
            <input
              type="text"
              className="mt-3 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200 text-sm"
              placeholder="Cari username atau nama…"
              value={ownerSearch}
              onChange={(e) => setOwnerSearch(e.target.value)}
              disabled={ownerLoading}
            />
            <div className="mt-2 flex-1 min-h-0 overflow-y-auto border border-slate-700 rounded-lg bg-slate-800/50">
              <button
                type="button"
                className={`w-full text-left px-3 py-2 text-sm border-b border-slate-700 hover:bg-slate-700/50 ${selectedOwnerId === null ? 'bg-slate-600/50 text-slate-100' : 'text-slate-300'}`}
                onClick={() => setSelectedOwnerId(null)}
              >
                — Lepas owner (kosongkan)
              </button>
              {filteredUsersForOwner.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm border-b border-slate-700/80 hover:bg-slate-700/50 ${selectedOwnerId === u.id ? 'bg-slate-600/50 text-slate-100' : 'text-slate-300'}`}
                  onClick={() => setSelectedOwnerId(u.id)}
                >
                  <span className="font-medium">{u.username}</span>
                  {u.name && u.name !== u.username && <span className="text-slate-400 ml-2">{u.name}</span>}
                </button>
              ))}
              {filteredUsersForOwner.length === 0 && ownerSearch.trim() && <p className="px-3 py-4 text-slate-500 text-sm">Tidak ada user cocok.</p>}
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setOwnerModal(null)} disabled={ownerLoading}>Batal</Button>
              <Button variant="primary" onClick={saveOwner} disabled={ownerLoading}>{ownerLoading ? 'Menyimpan…' : 'Simpan'}</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Hapus weapon?"
        message={deleteConfirm ? `Hapus SN untuk "${deleteConfirm.name}"? Tidak bisa dibatalkan. Weapon yang terhubung ke order tidak bisa dihapus.` : ''}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={deleteWeapon}
        loading={deleteLoading}
      />
    </div>
  );
}
