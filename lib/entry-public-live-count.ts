import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

/**
 * Public ana sayfa ve sitemap ile aynı kaynak: `public.entries`.
 * Taslak/pasif/silinmiş satırları dışlamak için şemada kolonlar eklendikçe
 * aşağıdaki deneme sırası genişletilir. Kolon yoksa: tüm satırlar canlı kabul edilir
 * (mevcut prod şemasında görünürlük flag’i bulunmuyor).
 */

export type PublicLiveCountMode =
  | "all_rows"
  | "deleted_at_null"
  | "is_published_true"
  | "is_published_true_and_deleted_at_null"
  | "status_published";

function isMissingColumnOrSchemaError(err: PostgrestError | null): boolean {
  if (!err?.message) return false;
  return /column|does not exist|schema|42703|could not find|not find the column/i.test(
    err.message
  );
}

type CountOutcome = {
  count: number | null;
  error: PostgrestError | null;
  mode: PublicLiveCountMode;
};

async function finalize(
  res: { count: number | null; error: PostgrestError | null },
  mode: PublicLiveCountMode
): Promise<CountOutcome | null> {
  if (!res.error && typeof res.count === "number") {
    return { count: res.count, error: null, mode };
  }
  if (res.error && !isMissingColumnOrSchemaError(res.error)) {
    return { count: null, error: res.error, mode: "all_rows" };
  }
  return null;
}

/**
 * Public sitede sayılan “canlı” entry adedi (visibility kolonlarına göre veya tüm satırlar).
 */
export async function countPublicLiveEntries(
  service: SupabaseClient
): Promise<CountOutcome> {
  const a1 = await finalize(
    await service
      .from("entries")
      .select("id", { head: true, count: "exact" })
      .eq("is_published", true)
      .is("deleted_at", null),
    "is_published_true_and_deleted_at_null"
  );
  if (a1) return a1;

  const a2 = await finalize(
    await service
      .from("entries")
      .select("id", { head: true, count: "exact" })
      .eq("is_published", true),
    "is_published_true"
  );
  if (a2) return a2;

  const a3 = await finalize(
    await service
      .from("entries")
      .select("id", { head: true, count: "exact" })
      .is("deleted_at", null),
    "deleted_at_null"
  );
  if (a3) return a3;

  const a4 = await finalize(
    await service
      .from("entries")
      .select("id", { head: true, count: "exact" })
      .eq("status", "published"),
    "status_published"
  );
  if (a4) return a4;

  const a5 = await service
    .from("entries")
    .select("id", { head: true, count: "exact" });
  return {
    count: typeof a5.count === "number" ? a5.count : null,
    error: a5.error,
    mode: "all_rows",
  };
}

/**
 * Aynı canlı filtresi + `created_at >= sinceIso` (son 7 gün için).
 */
export async function countPublicLiveEntriesSince(
  service: SupabaseClient,
  sinceIso: string
): Promise<CountOutcome> {
  const base = () =>
    service
      .from("entries")
      .select("id", { head: true, count: "exact" })
      .gte("created_at", sinceIso);

  const a1 = await finalize(
    await base().eq("is_published", true).is("deleted_at", null),
    "is_published_true_and_deleted_at_null"
  );
  if (a1) return a1;

  const a2 = await finalize(
    await base().eq("is_published", true),
    "is_published_true"
  );
  if (a2) return a2;

  const a3 = await finalize(await base().is("deleted_at", null), "deleted_at_null");
  if (a3) return a3;

  const a4 = await finalize(
    await base().eq("status", "published"),
    "status_published"
  );
  if (a4) return a4;

  const a5 = await base();
  return {
    count: typeof a5.count === "number" ? a5.count : null,
    error: a5.error,
    mode: "all_rows",
  };
}
