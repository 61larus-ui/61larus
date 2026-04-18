-- Temporary diagnostics: invoker-only session info (no entries table access).
-- Safe to drop after debugging: drop function public.debug_admin_pg_session_invoker();

create or replace function public.debug_admin_pg_session_invoker()
returns json
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select json_build_object(
    'current_user', current_user::text,
    'current_schema', current_schema()::text,
    'jwt_claim_role', current_setting('request.jwt.claim.role', true)
  );
$$;

revoke all on function public.debug_admin_pg_session_invoker() from public;
grant execute on function public.debug_admin_pg_session_invoker() to service_role;
