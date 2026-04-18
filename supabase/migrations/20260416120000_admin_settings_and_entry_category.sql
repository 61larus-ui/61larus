-- Admin panel: optional password persistence (API uses service_role only).
-- Entry category for CMS (homepage may ignore until wired).

create table if not exists public.admin_settings (
  id smallint primary key default 1 check (id = 1),
  password_hash text not null default '',
  password_salt text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.admin_settings enable row level security;

alter table public.entries add column if not exists category text;
