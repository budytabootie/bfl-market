# Tracing: "Invalid login credentials"

## Di mana error ini muncul?

- **Satu tempat:** `src/app/login/page.tsx`
- **Baris:** `const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });`
- **Tampilan:** `setError(err.message)` → pesan dari Supabase ditampilkan ke user.

Jadi teks **"Invalid login credentials"** **bukan** dari kode kita, melainkan **langsung dari Supabase Auth** ketika `signInWithPassword` gagal.

---

## Alur login di app kita

1. User isi **Username** + **Password**.
2. Username dinormalisasi: `trim()` + `toLowerCase()`.
3. Email dibuat: `usernameToBflEmail(username)` → `{local}@bfl.local` (huruf kecil, karakter aneh diganti `_`).
4. Panggil: `supabase.auth.signInWithPassword({ email, password })`.
5. Kalau gagal → Supabase mengembalikan error → `err.message` (sering "Invalid login credentials") ditampilkan.

---

## Penyebab umum "Invalid login credentials" (dari Supabase)

| Penyebab | Keterangan |
|----------|------------|
| **Password salah** | Paling sering. Typo, caps lock, lupa sudah ganti password (reset admin / must_change_password). |
| **Email tidak ada** | Di kita = username salah/berbeda sehingga `email` tidak match dengan yang di Auth. Mis. user pakai "Rudy" tapi di Auth terdaftar "rudy" → sama (karena kita normalisasi). Tapi kalau ada spasi/karakter aneh yang beda cara normalize, bisa beda. |
| **Email belum dikonfirmasi** | Di kita pakai `email_confirm: true` saat create user, jadi biasanya sudah confirmed. |
| **User banned / disabled** | Akun di-ban atau dinonaktifkan di Supabase Dashboard. |
| **Rate limiting** | Terlalu banyak percobaan login gagal; Supabase bisa memblokir sementara (pesan bisa tetap "Invalid login credentials"). |

Supabase sengaja memakai pesan **generic** (tidak membedakan "email salah" vs "password salah") untuk alasan keamanan.

---

## Kemungkinan khusus di BFL (username → email)

- **Auth users** punya email bentuk `xxx@bfl.local` (dari `usernameToBflEmail`).
- Kalau di **Supabase Dashboard** email user pernah diubah manual, maka login dengan username lama tidak akan cocok → **Invalid login credentials**.
- **Solusi:** Cek di Supabase → Authentication → Users. Email harus persis `username@bfl.local` (username huruf kecil, tanpa spasi).

---

## Ringkasan: kenapa "sering" kejadian?

1. **Password salah** (lupa, typo, atau sudah direset).
2. **Session habis** (setelah 24 jam) → user login lagi → salah ketik username/password.
3. **Username/email tidak match** (normalisasi, atau email di Auth diubah manual).
4. **Rate limit** setelah beberapa kali salah login.

Perbaikan yang sudah dilakukan: normalisasi username di login, cookie session 24 jam dengan opsi benar, dan hint di UI saat gagal login.
