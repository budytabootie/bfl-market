-- Block process_order from marking order as 'completed' when order has any PO item.
-- Such orders become 'listed' and only non-PO approved items are processed; PO items stay in new flow.

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
begin
  if not public.is_superadmin_or_treasurer() then raise exception 'Not allowed'; end if;

  select user_id into v_order_user from public.orders where id = p_order_id;
  if v_order_user is null then raise exception 'Order not found'; end if;

  select exists (select 1 from public.order_items where order_id = p_order_id and is_po = true) into v_has_po;

  if v_has_po then
    -- Order has PO item(s): do NOT set completed. Set listed and only process non-PO items.
    update public.orders set status = 'listed', approved_by = auth.uid() where id = p_order_id and status = 'pending';
    if not found then raise exception 'Order not found or already processed'; end if;
  else
    -- No PO items: current behavior (complete order)
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

  if v_has_po then
    perform public.log_activity('order.po_listed', 'orders', p_order_id::text, '{"note": "has_po_items"}');
  else
    perform public.log_activity('order.processed', 'orders', p_order_id::text, '{}');
  end if;
end;
$$;
