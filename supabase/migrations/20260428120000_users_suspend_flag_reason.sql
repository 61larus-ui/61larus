-- Askı: boolean + isteğe bağlı gerekçe (tarih alanı korunur).

alter table public.users
  add column if not exists is_platform_access_suspended boolean not null default false;

alter table public.users
  add column if not exists platform_access_suspended_reason text;

update public.users
set is_platform_access_suspended = true
where platform_access_suspended_at is not null
  and is_platform_access_suspended = false;

comment on column public.users.is_platform_access_suspended is
  'Platform erişimi askıda; platform_access_suspended_at ile birlikte kullanılır.';

comment on column public.users.platform_access_suspended_reason is
  'Askıya alma gerekçesi (yönetici notu, isteğe bağlı).';
