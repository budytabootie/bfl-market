-- Server-side pagination + bundled orders/items for admin Order History (no hard cap).

create or replace function public.get_admin_orders_history_page(
  p_kind text,
  p_po_tab text,
  p_search text,
  p_status text,
  p_filter_approver text,
  p_page int,
  p_page_size int
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offset int;
  v_limit int;
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_page_size int := least(greatest(coalesce(p_page_size, 10), 1), 50);
  v_search text := btrim(coalesce(p_search, ''));
  v_status text := btrim(coalesce(p_status, ''));
  v_app text := coalesce(p_filter_approver, '');
  v_kind text := lower(btrim(coalesce(p_kind, 'reguler')));
  v_po_tab text := lower(btrim(coalesce(p_po_tab, 'bayar')));
  v_total bigint;
  v_stats_reg bigint;
  v_stats_po bigint;
  v_po_bayar bigint;
  v_po_diterima bigint;
  v_po_selesai bigint;
  v_order_ids uuid[];
  r_orders json;
  r_items json;
  r_oiw json;
begin
  if not public.is_superadmin_or_treasurer() then
    raise exception 'Tidak punya izin';
  end if;

  if v_kind not in ('reguler', 'po') then
    raise exception 'p_kind harus reguler atau po';
  end if;

  v_limit := v_page_size;
  v_offset := (v_page - 1) * v_page_size;

  -- Stats: all orders matching search/status/approver (no kind/po-tab filter)
  with base as (
    select
      o.id,
      exists (
        select 1 from public.order_items oi
        where oi.order_id = o.id and oi.is_po = true
      ) as has_po
    from public.orders o
    inner join public.users buyer on buyer.id = o.user_id
    left join public.users approver on approver.id = o.approved_by
    where
      (v_search = '' or buyer.username ilike '%' || v_search || '%' or buyer.name ilike '%' || v_search || '%')
      and (v_status = '' or o.status::text = v_status)
      and (
        v_app = ''
        or (v_app = '__none__' and o.approved_by is null)
        or (
          v_app <> '__none__'
          and o.approved_by is not null
          and (approver.username = v_app or approver.name = v_app)
        )
      )
  )
  select
    count(*) filter (where not has_po)::bigint,
    count(*) filter (where has_po)::bigint
  into v_stats_reg, v_stats_po
  from base;

  -- PO sub-tab totals (same filters; scalar counts always return one row)
  select coalesce((
    select count(*)::bigint
    from public.orders o
    inner join public.users buyer on buyer.id = o.user_id
    left join public.users approver on approver.id = o.approved_by
    where
      (v_search = '' or buyer.username ilike '%' || v_search || '%' or buyer.name ilike '%' || v_search || '%')
      and (v_status = '' or o.status::text = v_status)
      and (
        v_app = ''
        or (v_app = '__none__' and o.approved_by is null)
        or (
          v_app <> '__none__'
          and o.approved_by is not null
          and (approver.username = v_app or approver.name = v_app)
        )
      )
      and exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.is_po = true)
      and o.status = 'listed'::public.order_status
      and coalesce(o.paid_amount, 0) < (
        select coalesce(sum(oi2.subtotal), 0)
        from public.order_items oi2
        where oi2.order_id = o.id and oi2.is_po = true
      )
  ), 0) into v_po_bayar;

  select coalesce((
    select count(*)::bigint
    from public.orders o
    inner join public.users buyer on buyer.id = o.user_id
    left join public.users approver on approver.id = o.approved_by
    where
      (v_search = '' or buyer.username ilike '%' || v_search || '%' or buyer.name ilike '%' || v_search || '%')
      and (v_status = '' or o.status::text = v_status)
      and (
        v_app = ''
        or (v_app = '__none__' and o.approved_by is null)
        or (
          v_app <> '__none__'
          and o.approved_by is not null
          and (approver.username = v_app or approver.name = v_app)
        )
      )
      and exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.is_po = true)
      and o.status = 'listed'::public.order_status
      and o.paid_at is not null
  ), 0) into v_po_diterima;

  select coalesce((
    select count(*)::bigint
    from public.orders o
    inner join public.users buyer on buyer.id = o.user_id
    left join public.users approver on approver.id = o.approved_by
    where
      (v_search = '' or buyer.username ilike '%' || v_search || '%' or buyer.name ilike '%' || v_search || '%')
      and (v_status = '' or o.status::text = v_status)
      and (
        v_app = ''
        or (v_app = '__none__' and o.approved_by is null)
        or (
          v_app <> '__none__'
          and o.approved_by is not null
          and (approver.username = v_app or approver.name = v_app)
        )
      )
      and exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.is_po = true)
      and o.status = 'completed'::public.order_status
  ), 0) into v_po_selesai;

  -- Page: filtered ids + total
  with base as (
    select
      o.id,
      o.created_at,
      exists (
        select 1 from public.order_items oi
        where oi.order_id = o.id and oi.is_po = true
      ) as has_po
    from public.orders o
    inner join public.users buyer on buyer.id = o.user_id
    left join public.users approver on approver.id = o.approved_by
    where
      (v_search = '' or buyer.username ilike '%' || v_search || '%' or buyer.name ilike '%' || v_search || '%')
      and (v_status = '' or o.status::text = v_status)
      and (
        v_app = ''
        or (v_app = '__none__' and o.approved_by is null)
        or (
          v_app <> '__none__'
          and o.approved_by is not null
          and (approver.username = v_app or approver.name = v_app)
        )
      )
  ),
  filtered as (
    select b.id, b.created_at
    from base b
    inner join public.orders o on o.id = b.id
    where
      case when v_kind = 'reguler' then not b.has_po
           when v_kind = 'po' then b.has_po
           else false end
      and case
        when v_kind <> 'po' then true
        when v_po_tab = 'bayar' then
          o.status = 'listed'::public.order_status
          and coalesce(o.paid_amount, 0) < (
            select coalesce(sum(oi2.subtotal), 0)
            from public.order_items oi2
            where oi2.order_id = o.id and oi2.is_po = true
          )
        when v_po_tab = 'diterima' then
          o.status = 'listed'::public.order_status
          and o.paid_at is not null
        when v_po_tab = 'selesai' then
          o.status = 'completed'::public.order_status
        else false
      end
  ),
  counted as (
    select count(*)::bigint as c from filtered
  ),
  paged as (
    select f.id, f.created_at
    from filtered f
    order by f.created_at desc
    limit v_limit offset v_offset
  )
  select
    (select c from counted),
    coalesce((select array_agg(p.id order by p.created_at desc) from paged p), array[]::uuid[])
  into v_total, v_order_ids;

  if v_order_ids is null or cardinality(v_order_ids) = 0 then
    return json_build_object(
      'total_count', coalesce(v_total, 0),
      'stats', json_build_object(
        'reguler', coalesce(v_stats_reg, 0),
        'po', coalesce(v_stats_po, 0),
        'po_tabs', json_build_object(
          'bayar', coalesce(v_po_bayar, 0),
          'diterima', coalesce(v_po_diterima, 0),
          'selesai', coalesce(v_po_selesai, 0)
        )
      ),
      'orders', '[]'::json,
      'items', '[]'::json,
      'order_item_weapons', '[]'::json
    );
  end if;

  select coalesce(jsonb_agg(row_order order by ord.created_at desc), '[]'::jsonb)::json
  into r_orders
  from (
    select
      o.created_at,
      jsonb_build_object(
        'id', o.id,
        'created_at', o.created_at,
        'status', o.status,
        'completed_at', o.completed_at,
        'approved_by', o.approved_by,
        'user_id', o.user_id,
        'paid_at', o.paid_at,
        'paid_amount', o.paid_amount,
        'users', jsonb_build_object('username', buyer.username, 'name', buyer.name),
        'approver', case
          when approver.id is null then null
          else jsonb_build_object('username', approver.username, 'name', approver.name)
        end
      ) as row_order
    from public.orders o
    inner join public.users buyer on buyer.id = o.user_id
    left join public.users approver on approver.id = o.approved_by
    where o.id = any(v_order_ids)
  ) ord;

  select coalesce(jsonb_agg(row_item), '[]'::jsonb)::json
  into r_items
  from (
    select
      jsonb_build_object(
        'id', oi.id,
        'order_id', oi.order_id,
        'catalog_id', oi.catalog_id,
        'quantity', oi.quantity,
        'price_each', oi.price_each,
        'subtotal', oi.subtotal,
        'status', oi.status,
        'is_po', oi.is_po,
        'ready_for_receive_at', oi.ready_for_receive_at,
        'received_at', oi.received_at,
        'catalog', jsonb_build_object('name', c.name, 'category', c.category)
      ) as row_item
    from public.order_items oi
    inner join public.catalog c on c.id = oi.catalog_id
    where oi.order_id = any(v_order_ids)
  ) sub;

  select coalesce(
    jsonb_agg(jsonb_build_object('order_item_id', x.order_item_id)),
    '[]'::jsonb
  )::json
  into r_oiw
  from (
    select distinct oiw.order_item_id
    from public.order_item_weapons oiw
    inner join public.order_items oi on oi.id = oiw.order_item_id
    where oi.order_id = any(v_order_ids)
  ) x;

  return json_build_object(
    'total_count', coalesce(v_total, 0),
    'stats', json_build_object(
      'reguler', coalesce(v_stats_reg, 0),
      'po', coalesce(v_stats_po, 0),
      'po_tabs', json_build_object(
        'bayar', coalesce(v_po_bayar, 0),
        'diterima', coalesce(v_po_diterima, 0),
        'selesai', coalesce(v_po_selesai, 0)
      )
    ),
    'orders', coalesce(r_orders, '[]'::json),
    'items', coalesce(r_items, '[]'::json),
    'order_item_weapons', coalesce(r_oiw, '[]'::json)
  );
end;
$$;

grant execute on function public.get_admin_orders_history_page(text, text, text, text, text, int, int) to authenticated;
