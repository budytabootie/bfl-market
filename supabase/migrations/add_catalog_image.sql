-- Add image_url to catalog for product images
alter table public.catalog add column if not exists image_url text;

-- Storage bucket & policies: buat bucket "catalog-images" di Supabase Dashboard (Storage)
-- lalu jalankan policies ini, atau jalankan seluruh file - bucket akan dibuat jika belum ada.
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'catalog-images') then
    insert into storage.buckets (id, name, public) values ('catalog-images', 'catalog-images', true);
  end if;
end $$;

-- Allow authenticated users to upload
drop policy if exists "catalog_images_upload" on storage.objects;
create policy "catalog_images_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog-images');

drop policy if exists "catalog_images_update" on storage.objects;
create policy "catalog_images_update" on storage.objects for update to authenticated
  using (bucket_id = 'catalog-images');

drop policy if exists "catalog_images_delete" on storage.objects;
create policy "catalog_images_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'catalog-images');
