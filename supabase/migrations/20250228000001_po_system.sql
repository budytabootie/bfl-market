-- PO System: po_products, po_weekly_availability, app_settings, order_items.is_po, helper functions

-- 1.1 po_products: products eligible for PO
create table if not exists public.po_products (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null unique references public.catalog(id) on delete cascade,
  created_at timestamptz default now()
);

create index if not exists idx_po_products_catalog on public.po_products(catalog_id);

-- 1.2 po_weekly_availability: which products are ready for PO each week
create table if not exists public.po_weekly_availability (
  id uuid primary key default gen_random_uuid(),
  po_product_id uuid not null references public.po_products(id) on delete cascade,
  week_start date not null,
  max_quantity integer check (max_quantity is null or max_quantity >= 0),
  created_at timestamptz default now(),
  unique(po_product_id, week_start)
);

create index if not exists idx_po_weekly_availability_week on public.po_weekly_availability(week_start);

-- 1.3 app_settings: config (e.g. week start day)
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- Seed default: Monday = 1
insert into public.app_settings (key, value) values ('po_week_start_day', '1')
on conflict (key) do nothing;

-- 1.4 Alter order_items: add is_po
alter table public.order_items add column if not exists is_po boolean not null default false;

create index if not exists idx_order_items_is_po on public.order_items(is_po) where is_po = true;

-- 1.5 Helper: get week start date
create or replace function public.get_week_start(p_date date, p_start_day int)
returns date language sql immutable as $$
  select p_date - ((extract(dow from p_date)::int - p_start_day + 7) % 7)::int;
$$;

-- 1.6 Helper: get current PO week start
create or replace function public.get_current_po_week()
returns date language plpgsql stable security definer set search_path = public as $$
declare
  v_start_day int;
begin
  select coalesce((value::int), 1) into v_start_day
  from public.app_settings where key = 'po_week_start_day';
  return public.get_week_start(current_date, v_start_day);
end;
$$;

grant execute on function public.get_week_start(date, int) to authenticated;
grant execute on function public.get_current_po_week() to authenticated;

-- 1.7 RLS
alter table public.po_products enable row level security;
alter table public.po_weekly_availability enable row level security;
alter table public.app_settings enable row level security;

create policy "po_products_select" on public.po_products for select using (auth.uid() is not null);
create policy "po_products_admin" on public.po_products for all using (public.is_superadmin_or_treasurer());

create policy "po_weekly_select" on public.po_weekly_availability for select using (auth.uid() is not null);
create policy "po_weekly_admin" on public.po_weekly_availability for all using (public.is_superadmin_or_treasurer());

create policy "app_settings_select" on public.app_settings for select using (auth.uid() is not null);
create policy "app_settings_admin" on public.app_settings for all using (public.is_superadmin_or_treasurer());

-- 1.8 Update process_order: skip warehouse deduction for PO items
create or replace function public.process_order(p_order_id uuid)
returns void language plpgsql as $$
declare
  r record;
  v_order_user uuid;
  v_ww_id uuid;
  v_wi_id uuid;
begin
  if not public.is_superadmin_or_treasurer() then raise exception 'Not allowed'; end if;

  select user_id into v_order_user from public.orders where id = p_order_id;
  if v_order_user is null then raise exception 'Order not found'; end if;

  update public.orders set status = 'completed', completed_at = now(), approved_by = auth.uid() where id = p_order_id and status = 'pending';
  if not found then raise exception 'Order not found or already processed'; end if;

  for r in
    select oi.id, oi.catalog_id, oi.quantity, c.category, oi.is_po
    from public.order_items oi
    join public.catalog c on c.id = oi.catalog_id
    where oi.order_id = p_order_id and oi.status = 'approved'
  loop
    if r.is_po then
      -- PO items: no warehouse deduction, just mark as processed
      update public.order_items set status = 'processed', processed_by = auth.uid(), processed_at = now() where id = r.id;
    elsif r.category = 'weapon' then
      select id into v_ww_id from public.warehouse_weapons
      where catalog_id = r.catalog_id and status = 'available' limit 1 for update;
      if v_ww_id is not null then
        update public.warehouse_weapons set status = 'in_use', owner_id = v_order_user where id = v_ww_id;
        update public.order_items set status = 'processed', warehouse_weapon_id = v_ww_id, processed_by = auth.uid(), processed_at = now() where id = r.id;
      end if;
    else
      select id into v_wi_id from public.warehouse_items where catalog_id = r.catalog_id and quantity >= r.quantity limit 1 for update;
      if v_wi_id is not null then
        update public.warehouse_items set quantity = quantity - r.quantity where id = v_wi_id;
        update public.order_items set status = 'processed', warehouse_item_id = v_wi_id, processed_by = auth.uid(), processed_at = now() where id = r.id;
      end if;
    end if;
  end loop;

  perform public.log_activity('order.processed', 'orders', p_order_id::text, '{}');
end;
$$;
