-- Add must_change_password to users. Existing users default false (no forced change).
-- New users and reset-password flows set it to true.
alter table public.users add column if not exists must_change_password boolean not null default false;
