-- Platform üye yönetimi (askı / yönetici anonimleştirme). Hard delete yok.

alter table public.users
  add column if not exists platform_access_suspended_at timestamptz;

alter table public.users
  add column if not exists admin_profile_anonymized_at timestamptz;

comment on column public.users.platform_access_suspended_at is
  'Yönetici tarafından üyelik erişimi geçici olarak durduruldu (yorum vb. engellenir).';

comment on column public.users.admin_profile_anonymized_at is
  'Yönetici tarafından profil / iletişim bilgisi anonimleştirildi.';
