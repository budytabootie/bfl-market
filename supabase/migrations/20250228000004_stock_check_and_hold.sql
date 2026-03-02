-- Stock check: available = warehouse - (pending + approved order_items)
-- Order items with status pending/approved implicitly "hold" stock until processed or rejected

create or replace function public.get_available_stock(p_catalog_ids uuid[])
returns table(catalog_id uuid, available bigint, category text)
language sql stable security definer set search_path = public as $$
  with catalog_info as (
    select c.id, c.category from public.catalog c where c.id = any(p_catalog_ids)
  ),
  warehouse_qty as (
    select ci.id, ci.category,
      case
        when ci.category = 'weapon' then
          (select count(*)::bigint from public.warehouse_weapons ww
           where ww.catalog_id = ci.id and ww.status = 'available')
        else
          coalesce((select sum(wi.quantity)::bigint from public.warehouse_items wi
                   where wi.catalog_id = ci.id), 0)
      end as total
    from catalog_info ci
  ),
  reserved as (
    select oi.catalog_id, coalesce(sum(oi.quantity), 0)::bigint as qty
    from public.order_items oi
    where oi.catalog_id = any(p_catalog_ids)
      and oi.is_po = false
      and oi.status in ('pending', 'approved')
    group by oi.catalog_id
  )
  select wq.id as catalog_id,
    greatest(0, wq.total - coalesce(r.qty, 0))::bigint as available,
    wq.category
  from warehouse_qty wq
  left join reserved r on r.catalog_id = wq.id;
$$;

grant execute on function public.get_available_stock(uuid[]) to authenticated;
