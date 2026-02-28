-- Fix storage untuk catalog images (jalankan di Supabase SQL Editor jika upload gambar error 400)
-- 1. Buat bucket catalog-images jika belum ada
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'catalog-images') then
    insert into storage.buckets (id, name, public) values ('catalog-images', 'catalog-images', true);
  end if;
end $$;

-- 2. Hapus policy lama jika ada, lalu buat baru
drop policy if exists "catalog_images_upload" on storage.objects;
drop policy if exists "catalog_images_update" on storage.objects;
drop policy if exists "catalog_images_delete" on storage.objects;

create policy "catalog_images_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'catalog-images');

create policy "catalog_images_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'catalog-images');

create policy "catalog_images_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'catalog-images');
