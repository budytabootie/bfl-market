-- Fix RLS infinite recursion: functions that read users/roles must use
-- SECURITY DEFINER so they bypass RLS (policies on those tables call these functions)

-- 1. is_superadmin - used in RLS on roles, role_permissions
create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid() and r.key = 'superadmin'
  );
$$;

-- 2. is_superadmin_or_treasurer - used in RLS on users, catalog, orders, etc
create or replace function public.is_superadmin_or_treasurer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid() and r.key in ('superadmin','treasurer')
  );
$$;

-- 3. current_user_permissions - reads users, roles, role_permissions (called via RPC)
create or replace function public.current_user_permissions()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(rp.permission), '{}')::text[]
  from public.users u
  join public.roles r on r.id = u.role_id
  left join public.role_permissions rp on rp.role_id = r.id
  where u.id = auth.uid();
$$;

-- 4. log_activity - reads users, roles (called from process_order, etc)
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
