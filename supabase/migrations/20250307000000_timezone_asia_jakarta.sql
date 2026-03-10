-- Set default timezone ke WIB (Asia/Jakarta) untuk session database.
-- Data tetap disimpan UTC (timestamptz); timezone ini mempengaruhi interpretasi
-- saat konversi ke text dan untuk fungsi yang pakai local time.
-- Jika gagal (permission), set manual di Supabase Dashboard → Project Settings → Database → Time zone.

ALTER DATABASE postgres SET timezone TO 'Asia/Jakarta';
