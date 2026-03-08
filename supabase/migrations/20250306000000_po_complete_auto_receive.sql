-- 1. complete_po_order: set order completed + all PO items to processed (atomic, with processed_by)
-- 2. auto_receive_po_items: 24h auto-receive in one transaction
-- 3. process_order: only mark weapon item processed if SN count = quantity

-- 1. complete_po_order(p_order_id uuid)
create or replace function public.complete_po_order(p_order_id uuid)
returns void language plpgsql as $$
begin
  if not public.is_superadmin_or_treasurer() then raise exception 'Not allowed'; end if;

  update public.orders
  set status = 'completed', completed_at = now()
  where id = p_order_id and status = 'listed';
  if not found then raise exception 'Order not found or not listed'; end if;

  update public.order_items
  set status = 'processed', processed_by = auth.uid(), processed_at = now()
  where order_id = p_order_id and is_po = true;

  perform public.log_activity('order.po_completed', 'orders', p_order_id::text, '{}');
end;
$$;

-- 2. auto_receive_po_items() returns number of items updated (call on page load or cron)
create or replace function public.auto_receive_po_items()
returns int language plpgsql as $$
declare
  v_count int;
begin
  if not public.is_superadmin_or_treasurer() then return 0; end if;
  with updated as (
    update public.order_items
    set received_at = now()
    where is_po = true
      and received_at is null
      and ready_for_receive_at is not null
      and ready_for_receive_at + interval '24 hours' <= now()
    returning id
  )
  select count(*) from updated into v_count;
  return v_count;
end;
$$;

-- 3. process_order: only mark weapon item as processed when SN count = quantity
create or replace function public.process_order(p_order_id uuid)
returns void language plpgsql as $$
declare
  r record;
  w record;
  v_order_user uuid;
  v_ww_id uuid;
  v_wi_id uuid;
  v_weapon_count int;
  v_has_po boolean;
  v_can_mark_weapon boolean;
begin
  if not public.is_superadmin_or_treasurer() then raise exception 'Not allowed'; end if;

  select user_id into v_order_user from public.orders where id = p_order_id;
  if v_order_user is null then raise exception 'Order not found'; end if;

  select exists (select 1 from public.order_items where order_id = p_order_id and is_po = true) into v_has_po;

  if v_has_po then
    update public.orders set status = 'listed', approved_by = auth.uid() where id = p_order_id and status = 'pending';
    if not found then raise exception 'Order not found or already processed'; end if;
  else
    update public.orders set status = 'completed', completed_at = now(), approved_by = auth.uid() where id = p_order_id and status = 'pending';
    if not found then raise exception 'Order not found or already processed'; end if;
  end if;

  for r in
    select oi.id, oi.catalog_id, oi.quantity, c.category, oi.is_po, oi.warehouse_weapon_id as legacy_weapon_id
    from public.order_items oi
    join public.catalog c on c.id = oi.catalog_id
    where oi.order_id = p_order_id and oi.status = 'approved' and oi.is_po = false
  loop
    if r.category = 'weapon' then
      select count(*) into v_weapon_count from public.order_item_weapons where order_item_id = r.id;
      v_can_mark_weapon := false;
      if v_weapon_count > 0 and v_weapon_count = r.quantity then
        for w in
          select oiw.warehouse_weapon_id as ww_id from public.order_item_weapons oiw where oiw.order_item_id = r.id
        loop
          update public.warehouse_weapons set status = 'in_use', owner_id = v_order_user where id = w.ww_id;
        end loop;
        v_can_mark_weapon := true;
      elsif r.legacy_weapon_id is not null and r.quantity = 1 then
        select id into v_ww_id from public.warehouse_weapons
        where id = r.legacy_weapon_id and catalog_id = r.catalog_id and status = 'available' for update;
        if v_ww_id is not null then
          update public.warehouse_weapons set status = 'in_use', owner_id = v_order_user where id = v_ww_id;
          v_can_mark_weapon := true;
        end if;
      end if;
      if v_can_mark_weapon then
        update public.order_items set status = 'processed', processed_by = auth.uid(), processed_at = now() where id = r.id;
      end if;
      v_ww_id := null;
    else
      select id into v_wi_id from public.warehouse_items where catalog_id = r.catalog_id and quantity >= r.quantity limit 1 for update;
      if v_wi_id is not null then
        update public.warehouse_items set quantity = quantity - r.quantity where id = v_wi_id;
        update public.order_items set status = 'processed', warehouse_item_id = v_wi_id, processed_by = auth.uid(), processed_at = now() where id = r.id;
      end if;
    end if;
  end loop;

  if v_has_po then
    perform public.log_activity('order.po_listed', 'orders', p_order_id::text, '{"note": "has_po_items"}');
  else
    perform public.log_activity('order.processed', 'orders', p_order_id::text, '{}');
  end if;
end;
$$;

grant execute on function public.complete_po_order(uuid) to authenticated;
grant execute on function public.auto_receive_po_items() to authenticated;
