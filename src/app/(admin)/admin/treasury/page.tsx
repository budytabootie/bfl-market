'use client';

import { useEffect, useState, type FormEvent, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { logActivity } from '@/lib/activity';
import { TableToolbar } from '@/components/ui/TableToolbar';

type TreasuryRow = {
  id: string;
  user_id: string;
  cash_office: number;
  cash_personal: number;
  bank_office: number;
  bank_personal: number;
  note: string | null;
  users: { name: string; username: string } | null;
};

/** Supabase returns relation as array; we normalize to single object when loading */
type TreasuryRowRaw = Omit<TreasuryRow, 'users'> & { users: { name: string; username: string }[] | null };

type UserOption = { id: string; name: string; username: string };

function formatAmount(n: number): string {
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function AdminTreasuryPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<TreasuryRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Add form
  const [userId, setUserId] = useState('');
  const [cashOffice, setCashOffice] = useState(0);
  const [cashPersonal, setCashPersonal] = useState(0);
  const [bankOffice, setBankOffice] = useState(0);
  const [bankPersonal, setBankPersonal] = useState(0);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCashOffice, setEditCashOffice] = useState(0);
  const [editCashPersonal, setEditCashPersonal] = useState(0);
  const [editBankOffice, setEditBankOffice] = useState(0);
  const [editBankPersonal, setEditBankPersonal] = useState(0);
  const [editNote, setEditNote] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TreasuryRow | null>(null);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = (r.users?.name ?? '').toLowerCase();
      const username = (r.users?.username ?? '').toLowerCase();
      return name.includes(q) || username.includes(q);
    });
  }, [rows, search]);

  const paginatedRows = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(from, from + PAGE_SIZE);
  }, [filteredRows, page]);

  const summary = useMemo(() => {
    let totalOffice = 0;
    let totalPersonal = 0;
    for (const r of rows) {
      totalOffice += Number(r.cash_office) + Number(r.bank_office);
      totalPersonal += Number(r.cash_personal) + Number(r.bank_personal);
    }
    return { totalOffice, totalPersonal };
  }, [rows]);

  const userIdsInTreasury = useMemo(() => new Set(rows.map((r) => r.user_id)), [rows]);
  const usersAvailableForAdd = useMemo(
    () => users.filter((u) => !userIdsInTreasury.has(u.id)),
    [users, userIdsInTreasury],
  );

  async function load() {
    setError(null);
    const { data: tData, error: tErr } = await supabase
      .from('treasury')
      .select('id, user_id, cash_office, cash_personal, bank_office, bank_personal, note, users(name, username)')
      .order('created_at', { ascending: false });
    if (tErr) {
      setError(`Gagal load treasury: ${tErr.message}`);
      setRows([]);
    } else {
      const raw = (tData ?? []) as TreasuryRowRaw[];
      setRows(raw.map((r) => ({ ...r, users: r.users?.[0] ?? null })));
    }

    const { data: uData, error: uErr } = await supabase.from('users').select('id, name, username').order('name');
    if (uErr) {
      setError((e) => (e ? `${e}; ` : '') + `Gagal load users: ${uErr.message}`);
    } else {
      setUsers((uData ?? []) as UserOption[]);
    }
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!userId) {
      setError('Pilih user.');
      return;
    }
    if (userIdsInTreasury.has(userId)) {
      setError('User ini sudah memiliki record treasury. Gunakan Edit.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const { data, error: insertErr } = await supabase
      .from('treasury')
      .insert({
        user_id: userId,
        cash_office: cashOffice,
        cash_personal: cashPersonal,
        bank_office: bankOffice,
        bank_personal: bankPersonal,
        note: note.trim() || null,
      })
      .select('id')
      .single();
    setSubmitting(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    const id = (data as { id: string }).id;
    await logActivity(supabase, 'treasury.create', 'treasury', id, {
      user_id: userId,
      cash_office: cashOffice,
      cash_personal: cashPersonal,
      bank_office: bankOffice,
      bank_personal: bankPersonal,
    });
    setUserId('');
    setCashOffice(0);
    setCashPersonal(0);
    setBankOffice(0);
    setBankPersonal(0);
    setNote('');
    load();
  }

  function startEdit(r: TreasuryRow) {
    setEditingId(r.id);
    setEditCashOffice(Number(r.cash_office));
    setEditCashPersonal(Number(r.cash_personal));
    setEditBankOffice(Number(r.bank_office));
    setEditBankPersonal(Number(r.bank_personal));
    setEditNote(r.note ?? '');
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    setUpdatingId(editingId);
    setError(null);
    const { error: updateErr } = await supabase
      .from('treasury')
      .update({
        cash_office: editCashOffice,
        cash_personal: editCashPersonal,
        bank_office: editBankOffice,
        bank_personal: editBankPersonal,
        note: editNote.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingId);
    setUpdatingId(null);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    await logActivity(supabase, 'treasury.update', 'treasury', editingId, {
      cash_office: editCashOffice,
      cash_personal: editCashPersonal,
      bank_office: editBankOffice,
      bank_personal: editBankPersonal,
    });
    setEditingId(null);
    load();
  }

  async function handleDelete(r: TreasuryRow) {
    setDeletingId(r.id);
    setError(null);
    const { error: delErr } = await supabase.from('treasury').delete().eq('id', r.id);
    setDeletingId(null);
    setConfirmDelete(null);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    await logActivity(supabase, 'treasury.delete', 'treasury', r.id, {
      user_name: r.users?.name,
      username: r.users?.username,
    });
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        Memuat…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      )}

      <Card title="Ringkasan">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 px-4 py-3">
            <div className="text-xs uppercase tracking-wider text-slate-500">Total Duit Kantor/Kelompok</div>
            <div className="text-xl font-semibold text-slate-100">{formatAmount(summary.totalOffice)}</div>
            <div className="text-xs text-slate-500">cash + bank (semua treasury)</div>
          </div>
          <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 px-4 py-3">
            <div className="text-xs uppercase tracking-wider text-slate-500">Total Duit Pribadi</div>
            <div className="text-xl font-semibold text-slate-100">{formatAmount(summary.totalPersonal)}</div>
            <div className="text-xs text-slate-500">cash + bank (semua treasury)</div>
          </div>
        </div>
      </Card>

      <Card title="Tambah Treasury">
        <p className="mb-4 text-xs text-slate-500">
          Pilih user (pemegang uang), isi jumlah duit kantor/kelompok dan pribadi di cash serta bank.
        </p>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px]">
            <label className="mb-1 block text-xs text-slate-500">User</label>
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">Pilih user</option>
              {usersAvailableForAdd.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.username})
                </option>
              ))}
              {usersAvailableForAdd.length === 0 && users.length > 0 && (
                <option value="" disabled>Semua user sudah punya record</option>
              )}
            </select>
          </div>
          <div className="w-28">
            <label className="mb-1 block text-xs text-slate-500">Cash Kantor</label>
            <input
              type="number"
              min={0}
              step="any"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
              value={cashOffice || ''}
              onChange={(e) => setCashOffice(Number(e.target.value))}
            />
          </div>
          <div className="w-28">
            <label className="mb-1 block text-xs text-slate-500">Cash Pribadi</label>
            <input
              type="number"
              min={0}
              step="any"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
              value={cashPersonal || ''}
              onChange={(e) => setCashPersonal(Number(e.target.value))}
            />
          </div>
          <div className="w-28">
            <label className="mb-1 block text-xs text-slate-500">Bank Kantor</label>
            <input
              type="number"
              min={0}
              step="any"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
              value={bankOffice || ''}
              onChange={(e) => setBankOffice(Number(e.target.value))}
            />
          </div>
          <div className="w-28">
            <label className="mb-1 block text-xs text-slate-500">Bank Pribadi</label>
            <input
              type="number"
              min={0}
              step="any"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
              value={bankPersonal || ''}
              onChange={(e) => setBankPersonal(Number(e.target.value))}
            />
          </div>
          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs text-slate-500">Catatan</label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
              placeholder="Opsional"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting || !userId}>
            {submitting ? 'Menyimpan…' : 'Tambah'}
          </Button>
        </form>
      </Card>

      <Card title="Daftar Treasury">
        <TableToolbar
          searchPlaceholder="Cari nama / username…"
          searchValue={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          totalCount={filteredRows.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
        <div className="mt-2 overflow-x-auto text-xs">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400">
                <th className="p-2 text-left">User</th>
                <th className="p-2 text-right">Cash Kantor</th>
                <th className="p-2 text-right">Cash Pribadi</th>
                <th className="p-2 text-right">Bank Kantor</th>
                <th className="p-2 text-right">Bank Pribadi</th>
                <th className="p-2 text-left">Catatan</th>
                <th className="p-2 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((r) => (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="p-2">
                    <span className="font-medium text-slate-200">
                      {r.users?.name ?? '-'}
                    </span>
                    <span className="ml-1 text-slate-500">({r.users?.username ?? '-'})</span>
                  </td>
                  {editingId === r.id ? (
                    <>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className="number-input w-24 text-right rounded border border-slate-700 bg-slate-900/60 px-2 py-1"
                          value={editCashOffice}
                          onChange={(e) => setEditCashOffice(Number(e.target.value))}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className="number-input w-24 text-right rounded border border-slate-700 bg-slate-900/60 px-2 py-1"
                          value={editCashPersonal}
                          onChange={(e) => setEditCashPersonal(Number(e.target.value))}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className="number-input w-24 text-right rounded border border-slate-700 bg-slate-900/60 px-2 py-1"
                          value={editBankOffice}
                          onChange={(e) => setEditBankOffice(Number(e.target.value))}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className="number-input w-24 text-right rounded border border-slate-700 bg-slate-900/60 px-2 py-1"
                          value={editBankPersonal}
                          onChange={(e) => setEditBankPersonal(Number(e.target.value))}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full rounded border border-slate-700 bg-slate-900/60 px-2 py-1"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <Button variant="secondary" onClick={saveEdit} disabled={updatingId === r.id}>
                            {updatingId === r.id ? '…' : 'Simpan'}
                          </Button>
                          <Button variant="ghost" onClick={cancelEdit}>
                            Batal
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2 text-right text-slate-300">{formatAmount(Number(r.cash_office))}</td>
                      <td className="p-2 text-right text-slate-300">{formatAmount(Number(r.cash_personal))}</td>
                      <td className="p-2 text-right text-slate-300">{formatAmount(Number(r.bank_office))}</td>
                      <td className="p-2 text-right text-slate-300">{formatAmount(Number(r.bank_personal))}</td>
                      <td className="p-2 max-w-[160px] truncate text-slate-500" title={r.note ?? ''}>
                        {r.note ?? '-'}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <Button variant="ghost" onClick={() => startEdit(r)}>
                            Edit
                          </Button>
                          {confirmDelete?.id === r.id ? (
                            <>
                              <Button
                                variant="danger"
                                onClick={() => handleDelete(r)}
                                disabled={deletingId === r.id}
                              >
                                {deletingId === r.id ? '…' : 'Ya, hapus'}
                              </Button>
                              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                                Batal
                              </Button>
                            </>
                          ) : (
                            <Button variant="danger" onClick={() => setConfirmDelete(r)}>
                              Hapus
                            </Button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredRows.length === 0 && (
          <p className="py-6 text-center text-slate-500">Belum ada data treasury.</p>
        )}
      </Card>
    </div>
  );
}
