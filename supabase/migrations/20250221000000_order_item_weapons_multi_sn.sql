-- Option B: support multiple SNs per weapon order item (quantity > 1).
-- New table: one row per (order_item, warehouse_weapon) so we can assign N weapons to one order line.
create table if not exists public.order_item_weapons (
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  warehouse_weapon_id uuid not null references public.warehouse_weapons(id) on delete restrict,
  primary key (order_item_id, warehouse_weapon_id)
);

create index if not exists idx_order_item_weapons_order_item on public.order_item_weapons(order_item_id);
create index if not exists idx_order_item_weapons_weapon on public.order_item_weapons(warehouse_weapon_id);

alter table public.order_item_weapons enable row level security;

create policy "order_item_weapons_admin"
  on public.order_item_weapons for all
  using (public.is_superadmin_or_treasurer());

comment on table public.order_item_weapons is 'Weapons (by SN) assigned to a weapon order item. One row per weapon when quantity > 1.';

-- process_order: for weapons, use order_item_weapons (N rows). If none, fallback to order_items.warehouse_weapon_id (legacy single).
create or replace function public.process_order(p_order_id uuid)
returns void language plpgsql as $$
declare
  r record;
  w record;
  v_order_user uuid;
  v_ww_id uuid;
  v_wi_id uuid;
  v_weapon_count int;
begin
  if not public.is_superadmin_or_treasurer() then raise exception 'Not allowed'; end if;

  select user_id into v_order_user from public.orders where id = p_order_id;
  if v_order_user is null then raise exception 'Order not found'; end if;

  update public.orders set status = 'completed', completed_at = now(), approved_by = auth.uid() where id = p_order_id and status = 'pending';
  if not found then raise exception 'Order not found or already processed'; end if;

  for r in
    select oi.id, oi.catalog_id, oi.quantity, c.category, oi.is_po, oi.warehouse_weapon_id as legacy_weapon_id
    from public.order_items oi
    join public.catalog c on c.id = oi.catalog_id
    where oi.order_id = p_order_id and oi.status = 'approved'
  loop
    if r.is_po then
      update public.order_items set status = 'processed', processed_by = auth.uid(), processed_at = now() where id = r.id;
    elsif r.category = 'weapon' then
      select count(*) into v_weapon_count from public.order_item_weapons where order_item_id = r.id;
      if v_weapon_count > 0 then
        for w in
          select oiw.warehouse_weapon_id as ww_id from public.order_item_weapons oiw where oiw.order_item_id = r.id
        loop
          update public.warehouse_weapons set status = 'in_use', owner_id = v_order_user where id = w.ww_id;
        end loop;
      elsif r.legacy_weapon_id is not null then
        select id into v_ww_id from public.warehouse_weapons
        where id = r.legacy_weapon_id and catalog_id = r.catalog_id and status = 'available' for update;
        if v_ww_id is not null then
          update public.warehouse_weapons set status = 'in_use', owner_id = v_order_user where id = v_ww_id;
        end if;
      end if;
      update public.order_items set status = 'processed', processed_by = auth.uid(), processed_at = now() where id = r.id;
      v_ww_id := null;
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
