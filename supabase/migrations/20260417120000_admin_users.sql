-- Multi-admin accounts with roles (server-side only via service role).

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  password_salt text not null,
  role text not null check (role in ('super_admin', 'editor_admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint admin_users_username_key unique (username),
  constraint admin_users_username_lower check (username = lower(username))
);

create index if not exists admin_users_role_idx on public.admin_users (role);

alter table public.admin_users enable row level security;
