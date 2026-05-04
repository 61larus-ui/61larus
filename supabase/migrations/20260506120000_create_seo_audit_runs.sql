-- SEO Komuta Merkezi: teknik tarama geçmişi (yalnızca service role / admin API).

create table public.seo_audit_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  score integer not null,
  checked_urls integer not null default 0,
  critical_issues integer not null default 0,
  warnings integer not null default 0,
  checks jsonb not null default '[]'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  raw_result jsonb not null default '{}'::jsonb
);

comment on table public.seo_audit_runs is
  'Admin teknik SEO tarama sonuçları; RLS açık, policy yok — yalnızca service_role.';

alter table public.seo_audit_runs enable row level security;

grant select, insert on table public.seo_audit_runs to service_role;
