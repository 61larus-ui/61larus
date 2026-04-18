-- Phase 3: notifications for comment replies (schema + RLS only).

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  type text not null check (type in ('comment_reply', 'mention')),
  entry_id uuid references public.entries(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_is_read_idx
  on public.notifications (user_id, is_read);

alter table public.notifications enable row level security;

-- Read: only the recipient's rows.
create policy "notifications_select_own"
  on public.notifications
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Update: only own rows (e.g. mark read later).
create policy "notifications_update_own"
  on public.notifications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Insert: authenticated only; narrow as specified (app creates rows from client).
create policy "notifications_insert_authenticated"
  on public.notifications
  for insert
  to authenticated
  with check (auth.uid() is not null);

grant select, insert, update on public.notifications to authenticated;
