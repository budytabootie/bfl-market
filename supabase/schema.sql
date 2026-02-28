-- GTA RP DASHBOARD - Full Schema
-- Run in Supabase SQL Editor

-- ENUMS
create type public.catalog_category as enum ('ammo', 'vest', 'attachment', 'weapon');
create type public.catalog_status as enum ('active', 'inactive');
create type public.weapon_status as enum ('available', 'in_use', 'broken', 'lost', 'confiscated');
create type public.order_status as enum ('pending', 'completed', 'cancelled');
create type public.order_item_status as enum ('pending', 'approved', 'rejected', 'processed');

-- ROLES
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  created_at timestamptz default now()
);

-- ROLE PERMISSIONS
create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission text not null,
  unique(role_id, permission)
);

-- USERS (app profile, linked to auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  username text not null unique,
  role_id uuid not null references public.roles(id),
  discord_id text,
  must_change_password boolean not null default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CATALOG
create table if not exists public.catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category public.catalog_category not null,
  base_price numeric(12,2) not null default 0,
  status public.catalog_status not null default 'active',
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- WEAPON RELATIONS (attachment/ammo -> weapon)
create table if not exists public.weapon_relations (
  id uuid primary key default gen_random_uuid(),
  weapon_catalog_id uuid not null references public.catalog(id) on delete cascade,
  related_catalog_id uuid not null references public.catalog(id) on delete cascade,
  relation_type text not null check (relation_type in ('attachment', 'ammo')),
  unique(weapon_catalog_id, related_catalog_id)
);

-- WAREHOUSE ITEMS (non-weapon stock)
create table if not exists public.warehouse_items (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references public.catalog(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- WAREHOUSE WEAPONS (weapon with serial, status, owner)
create table if not exists public.warehouse_weapons (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references public.catalog(id) on delete cascade,
  serial_number text not null unique,
  status public.weapon_status not null default 'available',
  owner_id uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ORDERS
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  status public.order_status not null default 'pending',
  created_at timestamptz default now(),
  completed_at timestamptz,
  approved_by uuid references public.users(id)
);

-- ORDER ITEMS
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  catalog_id uuid not null references public.catalog(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  price_each numeric(12,2) not null,
  subtotal numeric(12,2) not null,
  status public.order_item_status not null default 'pending',
  warehouse_item_id uuid references public.warehouse_items(id),
  warehouse_weapon_id uuid references public.warehouse_weapons(id),
  processed_by uuid references public.users(id),
  processed_at timestamptz
);

-- ACTIVITY LOGS
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  username text,
  role_key text,
  action text not null,
  entity text,
  entity_id text,
  details jsonb default '{}',
  created_at timestamptz default now()
);

-- INDEXES
create index if not exists idx_users_username on public.users(username);
create index if not exists idx_users_role on public.users(role_id);
create index if not exists idx_catalog_category on public.catalog(category);
create index if not exists idx_catalog_status on public.catalog(status);
create index if not exists idx_warehouse_items_catalog on public.warehouse_items(catalog_id);
create index if not exists idx_warehouse_weapons_catalog on public.warehouse_weapons(catalog_id);
create index if not exists idx_warehouse_weapons_status on public.warehouse_weapons(status);
create index if not exists idx_orders_user on public.orders(user_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_activity_logs_created on public.activity_logs(created_at desc);

-- HELPER FUNCTIONS (SECURITY DEFINER avoids RLS recursion when policies call these)
create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid() and r.key = 'superadmin'
  );
$$;

create or replace function public.is_superadmin_or_treasurer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid() and r.key in ('superadmin','treasurer')
  );
$$;

create or replace function public.current_user_permissions()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(rp.permission), '{}')::text[]
  from public.users u
  join public.roles r on r.id = u.role_id
  left join public.role_permissions rp on rp.role_id = r.id
  where u.id = auth.uid();
$$;

create or replace function public.log_activity(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_username text; v_role_key text;
begin
  if v_user_id is not null then
    select u.username, r.key into v_username, v_role_key
    from public.users u join public.roles r on r.id = u.role_id where u.id = v_user_id;
  end if;
  insert into public.activity_logs (user_id, username, role_key, action, entity, entity_id, details)
  values (v_user_id, v_username, v_role_key, p_action, p_entity, p_entity_id, p_details);
end;
$$;

-- process_order: deduct stock for approved items, mark as processed
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
    select oi.id, oi.catalog_id, oi.quantity, c.category
    from public.order_items oi
    join public.catalog c on c.id = oi.catalog_id
    where oi.order_id = p_order_id and oi.status = 'approved'
  loop
    if r.category = 'weapon' then
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

grant execute on function public.process_order(uuid) to authenticated;

-- DISCORD DM placeholder (called from app)
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.is_superadmin_or_treasurer() to authenticated;
grant execute on function public.current_user_permissions() to authenticated;
grant execute on function public.log_activity(text, text, text, jsonb) to authenticated;

-- RLS
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.users enable row level security;
alter table public.catalog enable row level security;
alter table public.weapon_relations enable row level security;
alter table public.warehouse_items enable row level security;
alter table public.warehouse_weapons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.activity_logs enable row level security;

-- ROLES
create policy "roles_superadmin" on public.roles for all using (public.is_superadmin());

-- ROLE_PERMISSIONS
create policy "role_permissions_superadmin" on public.role_permissions for all using (public.is_superadmin());

-- USERS
create policy "users_self" on public.users for select using (auth.uid() = id);
create policy "users_self_update" on public.users for update using (auth.uid() = id);
create policy "users_admin" on public.users for all using (public.is_superadmin_or_treasurer());

-- CATALOG: user sees active only, admin sees all
create policy "catalog_select_active" on public.catalog for select
  using (status = 'active' or public.is_superadmin_or_treasurer());
create policy "catalog_admin" on public.catalog for all using (public.is_superadmin_or_treasurer());

-- WEAPON_RELATIONS
create policy "weapon_relations_admin" on public.weapon_relations for all using (public.is_superadmin_or_treasurer());
create policy "weapon_relations_select" on public.weapon_relations for select using (true);

-- WAREHOUSE_ITEMS: admin only (user cannot see quantity)
create policy "warehouse_items_admin" on public.warehouse_items for all using (public.is_superadmin_or_treasurer());

-- WAREHOUSE_WEAPONS: admin only (user cannot see serial)
create policy "warehouse_weapons_admin" on public.warehouse_weapons for all using (public.is_superadmin_or_treasurer());

-- ORDERS
create policy "orders_insert" on public.orders for insert with check (auth.uid() is not null);
create policy "orders_select_own" on public.orders for select using (auth.uid() = user_id);
create policy "orders_admin" on public.orders for all using (public.is_superadmin_or_treasurer());

-- ORDER_ITEMS
create policy "order_items_own" on public.order_items for all
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "order_items_admin" on public.order_items for all
  using (exists (select 1 from public.orders o where o.id = order_id and public.is_superadmin_or_treasurer()));

-- ACTIVITY_LOGS
create policy "activity_logs_admin" on public.activity_logs for select using (public.is_superadmin_or_treasurer());
create policy "activity_logs_insert" on public.activity_logs for insert with check (auth.uid() is not null);

-- SEED ROLES
insert into public.roles (key, name) values
  ('superadmin', 'Super Admin'),
  ('treasurer', 'Treasurer'),
  ('user', 'User')
on conflict (key) do nothing;

-- SEED MENU PERMISSIONS
insert into public.role_permissions (role_id, permission)
select r.id, p from public.roles r cross join (
  values ('menu:admin'), ('menu:catalog'), ('menu:warehouse'), ('menu:weapons'), ('menu:orders'), ('menu:orders-history'),
         ('menu:users'), ('menu:permissions'), ('menu:activity'), ('menu:marketplace'), ('menu:my-orders')
) as t(p) where r.key = 'superadmin'
on conflict (role_id, permission) do nothing;

insert into public.role_permissions (role_id, permission)
select r.id, p from public.roles r cross join (
  values ('menu:admin'), ('menu:catalog'), ('menu:warehouse'), ('menu:weapons'), ('menu:orders'), ('menu:orders-history'),
         ('menu:activity'), ('menu:marketplace'), ('menu:my-orders')
) as t(p) where r.key = 'treasurer'
on conflict (role_id, permission) do nothing;

insert into public.role_permissions (role_id, permission)
select r.id, p from public.roles r cross join (
  values ('menu:marketplace'), ('menu:my-orders')
) as t(p) where r.key = 'user'
on conflict (role_id, permission) do nothing;

-- SEED SUPERADMIN
-- 1) Create user in Supabase Auth (Dashboard) with email superadmin@bfl.local, password admin123
-- 2) Run this (replace UUID with actual auth user id):
-- insert into public.users (id, name, username, role_id)
-- values (
--   'YOUR_AUTH_USER_UUID',
--   'Super Admin',
--   'superadmin',
--   (select id from public.roles where key = 'superadmin')
-- ) on conflict (id) do update set name=excluded.name, username=excluded.username, role_id=excluded.role_id;
