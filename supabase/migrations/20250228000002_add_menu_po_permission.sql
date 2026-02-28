-- Add menu:po permission for superadmin and treasurer
insert into public.role_permissions (role_id, permission)
select r.id, 'menu:po'
from public.roles r
where r.key in ('superadmin', 'treasurer')
on conflict (role_id, permission) do nothing;
