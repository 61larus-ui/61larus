import { slugifyEntryTitle } from "@/lib/entry-slug";

/** Canlı sitede indeks / paylaşım için kullanılan mutlak taban. */
export const PUBLIC_SITE_BASE = "https://61larus.com";

/**
 * Public entry URL: her zaman `/{segment}`.
 * Slug yoksa başlıktan türetilemez; `entryId` üzerinden stabil segment kullanılır.
 */
export function publicSiteEntryUrl(
  entryId: string,
  entrySlug: string | null | undefined
): string {
  const s = typeof entrySlug === "string" ? entrySlug.trim() : "";
  const segment = s.length > 0 ? s : slugifyEntryTitle("", entryId);
  return `${PUBLIC_SITE_BASE}/${encodeURI(segment)}`;
}
