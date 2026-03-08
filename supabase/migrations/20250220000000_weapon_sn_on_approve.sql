-- Allow approver to pre-select warehouse_weapon_id when approving weapon order items.
-- process_order: for weapon items, use order_items.warehouse_weapon_id if set (and valid), else pick one available.
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
    select oi.id, oi.catalog_id, oi.quantity, c.category, oi.is_po, oi.warehouse_weapon_id as pre_selected_weapon_id
    from public.order_items oi
    join public.catalog c on c.id = oi.catalog_id
    where oi.order_id = p_order_id and oi.status = 'approved'
  loop
    if r.is_po then
      update public.order_items set status = 'processed', processed_by = auth.uid(), processed_at = now() where id = r.id;
    elsif r.category = 'weapon' then
      v_ww_id := null;
      if r.pre_selected_weapon_id is not null then
        select id into v_ww_id from public.warehouse_weapons
        where id = r.pre_selected_weapon_id and catalog_id = r.catalog_id and status = 'available' for update;
      end if;
      if v_ww_id is null then
        select id into v_ww_id from public.warehouse_weapons
        where catalog_id = r.catalog_id and status = 'available' limit 1 for update;
      end if;
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
