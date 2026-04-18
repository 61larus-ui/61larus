-- Login: support passwords stored with pgcrypto crypt() (e.g. crypt('pw', gen_salt('bf'))).
-- App-side scrypt remains supported via hex hash + hex salt.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_verify_password_crypt(
  p_username text,
  p_plain text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_active boolean;
begin
  select u.password_hash, u.is_active
  into v_hash, v_active
  from public.admin_users u
  where u.username = lower(trim(p_username));

  if v_hash is null or coalesce(v_active, false) is not true then
    return false;
  end if;

  return v_hash = crypt(p_plain, v_hash);
end;
$$;

revoke all on function public.admin_verify_password_crypt(text, text) from public;
grant execute on function public.admin_verify_password_crypt(text, text) to service_role;
