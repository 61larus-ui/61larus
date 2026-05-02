-- FAZ 10B FIX — public.entries SELECT için yalnızca bu dosya (INSERT/UPDATE/DELETE policy yok).
--
-- Postgres RLS: permissive SELECT policies are OR-ed. Pairing avoids:
-- - EN 404: anon must see approved rows with title_en/content_en filled.
-- - TR feed break: anon must still see rows that are not "exclusive approved EN"
--   (same predicate as Policy 1 inverted), so drafts/candidates/TR stay visible.
--
-- service_role bypasses RLS unchanged (admin + server fallback).

alter table public.entries enable row level security;

drop policy if exists "public can read approved english entries" on public.entries;
drop policy if exists "entries_public_read_non_exclusive_english" on public.entries;

-- Approved + non-empty trimmed EN mirrors app/lib guard (loadApprovedEnglishEntryPublic).
create policy "public can read approved english entries"
  on public.entries
  as permissive
  for select
  to anon, authenticated
  using (
    global_translation_status = 'approved'
    and title_en is not null
    and length(trim(title_en)) > 0
    and content_en is not null
    and length(trim(content_en)) > 0
  );

-- All other rows (Turkçe yaşam döngüsü, taslak EN, vb.) görünür kalır.
create policy "entries_public_read_non_exclusive_english"
  on public.entries
  as permissive
  for select
  to anon, authenticated
  using (
    not (
      global_translation_status = 'approved'
      and title_en is not null
      and length(trim(title_en)) > 0
      and content_en is not null
      and length(trim(content_en)) > 0
    )
  );
