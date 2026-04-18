-- comment_reactions: align privileges + RLS with typical Supabase public tables so
-- authenticated clients (PostgREST JWT role "authenticated") can read counts and
-- insert/update/delete their own rows. Without GRANT and/or RLS policies, Postgres
-- returns 42501 "permission denied for table comment_reactions" for REST calls.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.comment_reactions TO authenticated;
GRANT ALL ON TABLE public.comment_reactions TO service_role;

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_reactions_select_authenticated" ON public.comment_reactions;
CREATE POLICY "comment_reactions_select_authenticated"
  ON public.comment_reactions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "comment_reactions_insert_own" ON public.comment_reactions;
CREATE POLICY "comment_reactions_insert_own"
  ON public.comment_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comment_reactions_update_own" ON public.comment_reactions;
CREATE POLICY "comment_reactions_update_own"
  ON public.comment_reactions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comment_reactions_delete_own" ON public.comment_reactions;
CREATE POLICY "comment_reactions_delete_own"
  ON public.comment_reactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
