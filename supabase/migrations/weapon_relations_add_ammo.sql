-- Extend weapon_relations to support both attachment and ammo (related_catalog_id + relation_type)
-- 1. Add new columns
alter table public.weapon_relations add column if not exists related_catalog_id uuid references public.catalog(id) on delete cascade;
alter table public.weapon_relations add column if not exists relation_type text check (relation_type in ('attachment', 'ammo'));

-- 2. Migrate existing data from attachment_catalog_id
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='weapon_relations' and column_name='attachment_catalog_id') then
    update public.weapon_relations set related_catalog_id = attachment_catalog_id, relation_type = 'attachment' where related_catalog_id is null;
  end if;
end $$;

-- 3. Drop old constraint and column
alter table public.weapon_relations drop constraint if exists weapon_relations_attachment_catalog_id_weapon_catalog_id_key;
alter table public.weapon_relations drop column if exists attachment_catalog_id;

-- 4. Make new columns not null (only for rows that have values)
alter table public.weapon_relations alter column related_catalog_id set not null;
alter table public.weapon_relations alter column relation_type set not null;

-- 5. Add new unique constraint
alter table public.weapon_relations drop constraint if exists weapon_relations_weapon_related_unique;
alter table public.weapon_relations add constraint weapon_relations_weapon_related_unique unique (weapon_catalog_id, related_catalog_id);
