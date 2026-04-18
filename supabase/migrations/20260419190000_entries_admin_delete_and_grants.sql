-- Ensure service_role can mutate entries via PostgREST when table grants are missing.

grant select, insert, update, delete on table public.entries to service_role;
