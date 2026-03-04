# Treasury – Test Cases (Manual Checklist)

Jalankan checklist ini sebelum merge fitur Treasury ke `main`. Centang setiap item setelah berhasil.

---

## Akses & navigasi

- [ ] Login sebagai **superadmin** → menu "Treasury" muncul di sidebar admin; klik bisa buka `/admin/treasury`.
- [ ] Login sebagai **treasurer** → menu "Treasury" muncul; bisa buka halaman.
- [ ] Login sebagai **user** (bukan admin/treasurer) → tidak punya akses admin; tidak ada menu Treasury (atau redirect jika akses URL langsung ke `/admin/treasury`).

---

## CRUD Treasury

- [ ] **Tambah**: Pilih user dari dropdown, isi cash_office, cash_personal, bank_office, bank_personal (dan note). Submit → record muncul di tabel; total summary (jika ada) ikut berubah.
- [ ] **Edit**: Ubah salah satu amount atau note pada record yang ada → simpan → data di tabel terupdate.
- [ ] **Validasi**: User yang sudah punya record tidak bisa ditambah lagi (atau form mengarah ke edit / upsert); tidak bisa pilih user duplikat.
- [ ] **Hapus** (jika ada): Hapus satu record → record hilang dari list; user di `users` tetap ada.

---

## Data & tampilan

- [ ] List menampilkan nama/username user (dari join `users`), 4 amount, note.
- [ ] Summary total kantor (cash_office + bank_office) dan total pribadi (cash_personal + bank_personal) benar (sum dari semua baris).
- [ ] Search/filter (jika ada) berfungsi (misalnya filter by nama user).

---

## Activity log

- [ ] Setelah create/update/delete treasury, di halaman Activity Logs muncul action yang sesuai (`treasury.create`, `treasury.update`, `treasury.delete`) dengan entity/label yang terbaca.

---

## Migration & permission

- [ ] Setelah jalankan migration: table `treasury` ada; RLS hanya mengizinkan akses untuk superadmin/treasurer.
- [ ] Permission `menu:treasury` ter-seed untuk role superadmin dan treasurer (cek di table `role_permissions` atau lewat perilaku menu).

---

**Tanggal test:** _______________  
**Tester:** _______________  
**Hasil:** Lulus / Gagal (jika gagal, tulis item yang gagal dan catatan di bawah).
