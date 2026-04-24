-- Optional author attribution on entries (batch inserts may omit; first-comment fallback remains in app).
alter table public.entries add column if not exists user_id uuid references public.users(id) on delete set null;

create index if not exists entries_user_id_idx on public.entries (user_id) where user_id is not null;
