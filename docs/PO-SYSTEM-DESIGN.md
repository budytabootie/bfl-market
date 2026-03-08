# Rancangan Teknis: Sistem PO (Purchase Order)

Dokumen ini merangkum perubahan database, status, alur, dan halaman untuk fitur PO sesuai spesifikasi yang disepakati.

---

## 1. Ringkasan Spesifikasi

| Aspek | Keputusan |
|-------|-----------|
| **Paid** | Level order. Kolom: `paid_at`, `paid_amount`. Sisa unpaid = total order − paid_amount. |
| **Received** | Level item. Kolom: `received_at`, `ready_for_receive_at`. User konfirmasi; 24 jam setelah ready → auto-receive per item. |
| **Approve** | Bukan selesai. Setelah approve → status order **listed**. |
| **Completed** | Setelah paid + semua item received (manual atau auto). |
| **Weapon PO** | SN input baru, assign seperti order reguler, masuk inventory kantor (owner = pembeli). |
| **Summary** | Per minggu PO: jumlah/nominal paid & unpaid, daftar barang (nama + qty). |
| **UI Order History PO** | Tab: Menunggu Bayar | Menunggu Diterima | Selesai. |

---

## 2. Perubahan Database

### 2.1 Tabel `orders` (order PO memakai tabel yang sama)

| Kolom (baru) | Tipe | Keterangan |
|--------------|------|------------|
| `paid_at` | `timestamptz` NULL | Waktu ditandai bayar (oleh admin). |
| `paid_amount` | `numeric(12,2)` NULL default 0 | Nominal yang sudah dibayar. Sisa = total order − paid_amount. |

- Hanya relevan untuk order yang punya item PO (`is_po`). Order reguler bisa tetap NULL/0.
- Total order = SUM(`order_items.subtotal`) untuk order tersebut.

### 2.2 Tabel `order_items` (khusus item PO)

| Kolom (baru) | Tipe | Keterangan |
|--------------|------|------------|
| `ready_for_receive_at` | `timestamptz` NULL | Admin tandai "barang sudah dikirim/ready" → set timestamp ini. Mulai hitung 24 jam untuk auto-receive. |
| `received_at` | `timestamptz` NULL | Waktu item diterima (user konfirmasi atau auto setelah 24 jam). |

- Untuk item non-PO kolom ini bisa NULL (tidak dipakai).
- Item PO: `received_at` NOT NULL = item sudah received (lengkap dengan received).

### 2.3 Status order (tetap pakai enum `order_status`)

Nilai yang dipakai untuk alur PO:

- `pending` — Order baru, belum approve.
- `listed` — **(BARU)** Setelah semua item PO di-approve; barang "sudah di listing", belum paid. (Perlu tambah nilai enum.)
- `completed` — Setelah paid + semua item received (+ SN weapon jika ada).
- `cancelled` — Dibatalkan.

**Perubahan enum:**

```sql
-- Tambah nilai 'listed' ke order_status
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'listed';
```

- Alur: `pending` → (approve semua item PO + klik "Tandai Listed") → `listed` → (paid + semua item received) → `completed`.

### 2.4 Status item PO (`order_items.status`)

Tetap: `pending` | `approved` | `rejected` | `processed`.

- Untuk PO: setelah "Tandai Listed", item tetap `approved` (tidak perlu `processed` sampai barang benar-benar keluar/SN weapon di-assign jika weapon).
- Atau per keputusan: item PO bisa punya status `processed` hanya saat order PO completed (SN weapon di-assign, dll.). Lihat bagian Alur.

### 2.5 Tabel lain

- **order_item_weapons** — Tetap dipakai untuk item weapon (reguler + PO): satu baris per SN yang di-assign. Untuk PO weapon, SN dari **input baru** → insert ke `warehouse_weapons` (inventory kantor) lalu insert ke `order_item_weapons`, `owner_id` = pembeli.
- **warehouse_weapons** — Untuk PO weapon: insert baris baru (SN dari admin) saat "memberikan barang", lalu link ke `order_items` lewat `order_item_weapons` (atau langsung `order_items.warehouse_weapon_id` jika satu weapon per item).

Tidak perlu tabel baru untuk "paid" atau "received"; cukup kolom di `orders` dan `order_items` di atas.

---

## 3. Alur (State Machine)

### 3.1 Order PO (level order)

```
pending → listed → completed
   ↓         ↓          ↑
cancelled  cancelled   (paid + semua item received, weapon SN jika ada)
```

- **pending → listed:** Admin approve semua item PO, lalu klik "Tandai Listed" (ganti dari tombol "Process Order"). Update `orders.status = 'listed'`.
- **listed → completed:** Semua syarat terpenuhi:
  - Order punya `paid_at` (dan optional: paid_amount ≥ total, atau tetap boleh partial).
  - Semua item PO punya `received_at` NOT NULL (user konfirmasi atau auto 24 jam setelah `ready_for_receive_at`).
  - Untuk setiap item PO yang weapon: sudah ada SN (lewat `order_item_weapons` / `warehouse_weapon_id`) dan sudah masuk inventory.
- **completed:** Set `orders.status = 'completed'`, `completed_at = now()`, `approved_by` bisa tetap atau di-set saat listed.

### 3.2 Item PO (level item)

- **pending → approved:** Seperti sekarang (admin approve).
- **approved:** Bisa (oleh admin) set `ready_for_receive_at` = now() → mulai hitung 24 jam.
- **received:** User klik "Konfirmasi Diterima" per item → set `received_at = now()`. Atau cron/job: tiap item dengan `ready_for_receive_at` + 24 jam dan `received_at` NULL → set `received_at = now()`.
- **Weapon PO:** Sebelum order completed, admin harus assign SN (input baru) untuk tiap item weapon PO → insert/update `warehouse_weapons`, link ke item (order_item_weapons / warehouse_weapon_id).

---

## 4. Halaman & Fitur yang Diubah/Ditambah

### 4.1 Admin – Pending Orders (PO)

- **Saat ini:** List order PO, approve/reject per item, tombol "Process Order".
- **Perubahan:**
  - Tombol "Process Order" diganti **"Tandai Listed"**.
  - On click: update `orders.status = 'listed'` (hanya jika semua item PO approved). Tidak lagi panggil `process_order` untuk PO (process_order hanya untuk order reguler yang completed).
  - Tetap tampilkan list item, approve/reject per item seperti sekarang.

### 4.2 Admin – Order History PO (atau section PO di Order History)

- **Saat ini:** Satu list order PO.
- **Perubahan:**
  - Tiga **tab**: **Menunggu Bayar** | **Menunggu Diterima** | **Selesai**.
  - **Menunggu Bayar:** `status = 'listed'` dan (`paid_at` NULL atau paid_amount < total).
  - **Menunggu Diterima:** `status = 'listed'`, sudah paid (paid_at set), ada item PO yang `received_at` NULL.
  - **Selesai:** `status = 'completed'` (atau semua item received + paid, lalu ada aksi "Selesaikan PO" yang set completed).
  - Di setiap order: tombol/aksi **"Tandai Bayar"** (modal input paid_amount + set paid_at), **"Tandai Dikirim/Ready"** per item (set ready_for_receive_at), dan untuk weapon PO: **"Assign SN"** (input SN baru, masuk inventory, link ke item). Tombol **"Selesaikan PO"** ketika paid + semua received + semua weapon PO sudah ada SN.

### 4.3 User – My Orders (order PO)

- **Baru atau perluas:** Tampilkan order PO user dengan status listed/paid/menunggu diterima/selesai.
  - Untuk item yang sudah `ready_for_receive_at` dan belum `received_at`: tombol **"Konfirmasi Diterima"** per item.
  - (Opsional) Tampilkan countdown 24 jam sampai auto-receive.

### 4.4 Admin – Summary PO (per minggu)

- **Halaman baru atau section baru:** Summary per **minggu PO** (pakai `get_current_po_week()` atau pilih minggu).
  - Tampilkan:
    - Jumlah order paid & total nominal paid.
    - Jumlah order unpaid & total nominal unpaid.
    - Quantity per barang (nama barang + total qty) yang di-PO di minggu itu (bisa breakdown paid/unpaid jika perlu).
  - Data dari `orders` + `order_items` yang `is_po` dan created dalam minggu tersebut (atau week_start sesuai).

### 4.5 Weapon PO – Assign SN

- **Tempat:** Di halaman admin Order History PO (tab Menunggu Diterima / sebelum Selesai), per item weapon PO.
- **Alur:** Admin klik "Assign SN" → modal input **SN baru** (barang dari supplier) → insert ke `warehouse_weapons` (catalog_id dari item, status misalnya `in_use`, owner_id = user_id pembeli) → insert ke `order_item_weapons` (order_item_id, warehouse_weapon_id) atau set `order_items.warehouse_weapon_id` jika satu weapon per item.
- Sama seperti order reguler weapon: SN tercatat di menu Weapons (inventory kantor) dengan owner.

---

## 5. Logic Penting

### 5.1 Total order & sisa unpaid

- Total order = `SUM(order_items.subtotal)` untuk `order_id` tersebut.
- Unpaid = total − `COALESCE(orders.paid_amount, 0)`.

### 5.2 Auto-receive per item (24 jam)

- **Cron / scheduled job** (misal tiap jam):  
  Untuk setiap `order_items` yang:
  - `is_po = true`
  - `ready_for_receive_at` IS NOT NULL
  - `received_at` IS NULL
  - `ready_for_receive_at` + interval '24 hours' ≤ now()  
  → update `received_at = now()`.

- Atau bisa dijalankan on-demand saat halaman Order History PO dibuka (batch update) jika tidak mau pakai cron.

### 5.3 Kapan order PO bisa "Selesaikan" (completed)

- `orders.paid_at` IS NOT NULL (dan optional: paid_amount ≥ total atau tetap boleh partial).
- Semua item PO di order itu: `received_at` IS NOT NULL.
- Semua item PO yang weapon: sudah punya `warehouse_weapon_id` / baris di `order_item_weapons`.
- On "Selesaikan PO": update `orders.status = 'completed'`, `completed_at = now()`.

### 5.4 Pemisahan order reguler vs PO di `process_order`

- Fungsi `process_order` hanya untuk order **reguler** (tanpa item PO, atau hanya proses item non-PO). Order yang punya item PO dan status `listed` **tidak** diproses lewat `process_order`; alur completed-nya lewat "Selesaikan PO" di halaman Order History PO.

---

## 6. Migrasi (Urutan disarankan)

1. **Migration 1:** Tambah enum `listed` ke `order_status`; tambah kolom `orders.paid_at`, `orders.paid_amount`; tambah kolom `order_items.ready_for_receive_at`, `order_items.received_at`.
2. **Migration 2 (jika perlu):** Constraint atau trigger untuk validasi (misalnya paid_amount ≤ total order); bisa tahap kedua.
3. **Kode:** Ubah Admin Pending Orders PO (tombol Tandai Listed), Order History PO (tab + aksi), User Orders (konfirmasi diterima), Summary PO per minggu, Assign SN untuk weapon PO, dan job/cron atau on-demand auto-receive 24 jam.

---

## 7. Checklist Implementasi

- [ ] Enum `order_status`: tambah `listed`.
- [ ] Tabel `orders`: kolom `paid_at`, `paid_amount`.
- [ ] Tabel `order_items`: kolom `ready_for_receive_at`, `received_at`.
- [ ] Admin Pending Orders PO: tombol "Tandai Listed", tidak panggil process_order untuk PO.
- [ ] Admin Order History PO: tab Menunggu Bayar / Menunggu Diterima / Selesai.
- [ ] Admin Order History PO: aksi Tandai Bayar (paid_amount + paid_at), Tandai Dikirim/Ready per item, Assign SN weapon PO, Selesaikan PO.
- [ ] User: konfirmasi diterima per item (order PO).
- [ ] Auto-receive 24 jam (cron atau on-demand).
- [ ] Halaman/section Summary PO per minggu (jumlah/nominal paid & unpaid, daftar barang + qty).
- [ ] Weapon PO: input SN baru → warehouse_weapons + link ke order item.

---

*Dokumen ini bisa disimpan di repo dan di-update seiring implementasi.*
