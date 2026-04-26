import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeEntrySlug } from "@/lib/slug";

/**
 * Turkish-aware ASCII slug (ç→c, ğ→g, ı/İ→i, ö→o, ş→s, ü→u; lowercase;
 * non-alnum → single hyphen; trim). If empty, uses first 8 hex chars of id (no hyphens).
 */
export function slugifyEntryTitle(
  title: string,
  idForFallback: string
): string {
  const s = normalizeEntrySlug(title);
  if (s.length > 0) return s;
  const compact = idForFallback
    .replace(/-/g, "")
    .slice(0, 8)
    .toLowerCase();
  if (/^[0-9a-f]+$/i.test(compact) && compact.length > 0) {
    return compact;
  }
  return "entry";
}

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
  const root = (baseSlug || "entry").replace(/^-+|-+$/g, "") || "entry";
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
