# GTA RP Dashboard

Dashboard Management & Ordering untuk GTA RP. Stack: Next.js 14+ (App Router), Supabase, TailwindCSS, TypeScript.

## Setup

1. Clone & install: `npm install`
2. Copy `.env.example` ke `.env.local`, isi:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (untuk create user & seed)
   - `DISCORD_BOT_TOKEN` (untuk kirim DM: credentials & reset password ke user)
3. Jalankan `supabase/schema.sql` di Supabase SQL Editor
4. Seed superadmin: `npx tsx scripts/seed-superadmin.ts`
5. Dev: `npm run dev`

## Login

- Username: `superadmin`
- Password: `admin123`

## Structure

- `/login` – Login (username + password)
- `/choose-panel` – Admin/Treasurer pilih Admin atau User Panel
- `/admin/*` – Admin Panel (katalog, warehouse, weapons, orders, users, permissions, activity)
- `/marketplace`, `/cart`, `/checkout`, `/orders` – User Panel

## Security

- RLS aktif di semua tabel
- Middleware protect route by permission
- User dibuat oleh admin (no public signup)
