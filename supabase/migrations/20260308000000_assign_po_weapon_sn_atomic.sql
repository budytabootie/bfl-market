-- Atomic assign SN for PO weapon items.
-- Prevents orphan warehouse_weapons rows when linking fails.

create or replace function public.assign_po_weapon_sn(
  p_order_id uuid,
  p_item_id uuid,
  p_catalog_id uuid,
  p_sn text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_user uuid;
  v_weapon_id uuid;
  v_trim_sn text;
  v_conflict_order_id uuid;
begin
  if not public.is_superadmin_or_treasurer() then
    raise exception 'Tidak punya izin assign SN';
  end if;

  v_trim_sn := btrim(coalesce(p_sn, ''));
  if v_trim_sn = '' then
    raise exception 'Serial number wajib diisi';
  end if;

  select o.user_id
    into v_order_user
  from public.orders o
  where o.id = p_order_id and o.status = 'listed';

  if v_order_user is null then
    raise exception 'Order tidak ditemukan atau status bukan listed';
  end if;

  if not exists (
    select 1
    from public.order_items oi
    join public.catalog c on c.id = oi.catalog_id
    where oi.id = p_item_id
      and oi.order_id = p_order_id
      and oi.catalog_id = p_catalog_id
      and oi.is_po = true
      and c.category = 'weapon'
  ) then
    raise exception 'Item order tidak valid untuk assign SN';
  end if;

  select ww.id into v_weapon_id
  from public.warehouse_weapons ww
  where ww.serial_number = v_trim_sn
  for update;

  if v_weapon_id is not null then
    if exists (
      select 1 from public.warehouse_weapons ww
      where ww.id = v_weapon_id and ww.catalog_id <> p_catalog_id
    ) then
      raise exception 'SN sudah dipakai untuk tipe weapon lain';
    end if;

    select oi.order_id
      into v_conflict_order_id
    from public.order_item_weapons oiw
    join public.order_items oi on oi.id = oiw.order_item_id
    join public.orders o on o.id = oi.order_id
    where oiw.warehouse_weapon_id = v_weapon_id
      and oiw.order_item_id <> p_item_id
      and o.status in ('pending', 'listed')
    limit 1;

    if v_conflict_order_id is not null then
      raise exception 'SN sudah dipakai di order aktif lain (%).', v_conflict_order_id;
    end if;
  else
    insert into public.warehouse_weapons (catalog_id, serial_number, status, owner_id)
    values (p_catalog_id, v_trim_sn, 'in_use', v_order_user)
    returning id into v_weapon_id;
  end if;

  insert into public.order_item_weapons (order_item_id, warehouse_weapon_id)
  values (p_item_id, v_weapon_id)
  on conflict do nothing;

  update public.warehouse_weapons
  set status = 'in_use',
      owner_id = v_order_user,
      updated_at = now()
  where id = v_weapon_id;

  return v_weapon_id;
end;
$$;

grant execute on function public.assign_po_weapon_sn(uuid, uuid, uuid, text) to authenticated;
