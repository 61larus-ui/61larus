import type { SupabaseClient } from "@supabase/supabase-js";
import { entrySlugRootFromBase } from "@/lib/slug";

export { slugifyEntryTitle } from "@/lib/slug";

/**
 * Reserves a unique `entries.slug` by appending -2, -3, … on collision.
 * When `excludeEntryId` is set (PATCH), that row is ignored for conflict checks.
 */
export async function ensureUniqueEntrySlug(
  service: SupabaseClient,
  baseSlug: string,
  options: { excludeEntryId?: string } = {}
): Promise<string> {
  const { excludeEntryId } = options;
  const root = entrySlugRootFromBase(baseSlug);
  let n = 0;
  for (;;) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    let q = service.from("entries").select("id").eq("slug", candidate).limit(1);
    if (excludeEntryId) {
      q = q.neq("id", excludeEntryId);
    }
    const { data, error } = await q;
    if (error && /column|schema|not exist|slug/i.test(error.message ?? "")) {
      return candidate;
    }
    if (error) {
      throw error;
    }
    if (!data?.length) {
      return candidate;
    }
    n += 1;
    if (n > 2000) {
      throw new Error("slug_serialization_exhausted");
    }
  }
}
