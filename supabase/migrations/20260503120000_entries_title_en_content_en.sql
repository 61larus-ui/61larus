-- FAZ 9A: Nullable English headline + body drafts for global translation workflow.

alter table public.entries
  add column if not exists title_en text;

alter table public.entries
  add column if not exists content_en text;

comment on column public.entries.title_en is
  'Global English title draft (rewritten for international readers).';

comment on column public.entries.content_en is
  'Global English body draft (rewritten, not literal translation).';
