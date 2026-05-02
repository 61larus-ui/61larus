-- Optional stamp for mutations (e.g. global translation approve).
alter table public.entries
  add column if not exists updated_at timestamptz;
