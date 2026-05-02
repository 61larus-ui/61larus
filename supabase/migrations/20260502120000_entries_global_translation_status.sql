-- FAZ 8B: Global Translation Engine — lifecycle column (text, not enum).
-- Application does not read/write this column yet.
-- Safe add: constant default avoids rewriting all rows on supported PostgreSQL versions.

alter table public.entries
  add column if not exists global_translation_status text default 'none';

comment on column public.entries.global_translation_status is
  'Workflow: none | candidate | draft | review | approved | rejected';
