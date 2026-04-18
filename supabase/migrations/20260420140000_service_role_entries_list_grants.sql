-- Admin API uses PostgREST with the service-role API key. Without explicit grants,
-- PostgreSQL can return "permission denied for table entries" even when RLS is bypassed.

grant usage on schema public to service_role;

grant select, insert, update, delete on table public.entries to service_role;

-- GET /api/admin/entries joins first comment + public.users for author labels
grant select on table public.comments to service_role;
grant select on table public.users to service_role;
