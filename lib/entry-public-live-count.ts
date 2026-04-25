import type { SupabaseClient } from "@supabase/supabase-js";

export async function countPublicLiveEntries(
  supabase: SupabaseClient
) {
  const { count, error } = await supabase
    .from("entries")
    .select("*", { count: "exact", head: true });

  if (error) return 0;
  return count || 0;
}
