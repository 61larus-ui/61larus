-- Optional `entry_topics` table (not wired in app). Does not alter `public.entries`
-- beyond what already exists — entries are id, title, content, created_at only.

create table if not exists public.entry_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists entry_topics_created_at_idx
  on public.entry_topics (created_at desc);

create index if not exists entry_topics_created_by_idx
  on public.entry_topics (created_by);

alter table public.entry_topics enable row level security;

drop policy if exists "entry_topics_select_own_or_all" on public.entry_topics;
create policy "entry_topics_select_own_or_all"
  on public.entry_topics
  for select
  to authenticated
  using (true);

drop policy if exists "entry_topics_insert_as_self" on public.entry_topics;
create policy "entry_topics_insert_as_self"
  on public.entry_topics
  for insert
  to authenticated
  with check (created_by = auth.uid());

grant select, insert on public.entry_topics to authenticated;
