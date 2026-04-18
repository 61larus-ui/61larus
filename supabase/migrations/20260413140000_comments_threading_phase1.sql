-- Phase 1: threaded replies — data model only (nullable reply metadata).
-- RLS: If policies reference explicit column lists in WITH CHECK, review them;
-- nullable FKs + text should not require loosening access by themselves.

alter table public.comments
  add column if not exists parent_comment_id uuid references public.comments(id) on delete set null,
  add column if not exists reply_to_user_id uuid references public.users(id) on delete set null,
  add column if not exists reply_to_username text;

create index if not exists comments_parent_comment_id_idx
  on public.comments(parent_comment_id);

create index if not exists comments_reply_to_user_id_idx
  on public.comments(reply_to_user_id);
