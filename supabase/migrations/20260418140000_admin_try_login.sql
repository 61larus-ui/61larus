-- Single-round login check: password_hash = crypt(plain, password_hash) inside DB (pgcrypto).
-- SECURITY DEFINER: consistent with table read regardless of RLS; execute limited to service_role.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_try_login(p_username text, p_plain text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
stable
as $$
declare
  v_role text;
begin
  select u.role  into v_role
  from public.admin_users u
  where u.username = lower(trim(p_username))
    and coalesce(u.is_active, false) is true
    and u.password_hash = crypt(p_plain, u.password_hash)
  limit 1;

  if v_role is null then
    return jsonb_build_object('ok', false);
  end if;

  return jsonb_build_object('ok', true, 'role', v_role);
end;
$$;

revoke all on function public.admin_try_login(text, text) from public;
grant execute on function public.admin_try_login(text, text) to service_role;
