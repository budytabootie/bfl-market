-- Treasury: track office/group vs personal money per holder (cash + bank)

create table if not exists public.treasury (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  cash_office numeric(12,2) not null default 0,
  cash_personal numeric(12,2) not null default 0,
  bank_office numeric(12,2) not null default 0,
  bank_personal numeric(12,2) not null default 0,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_treasury_user_id on public.treasury(user_id);

alter table public.treasury enable row level security;

create policy "treasury_admin"
  on public.treasury for all
  using (public.is_superadmin_or_treasurer())
  with check (public.is_superadmin_or_treasurer());

-- Seed menu:treasury for superadmin and treasurer
insert into public.role_permissions (role_id, permission)
select r.id, 'menu:treasury'
from public.roles r
where r.key in ('superadmin', 'treasurer')
on conflict (role_id, permission) do nothing;
