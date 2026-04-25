/** Canlı sitede indeks / paylaşım için kullanılan mutlak taban. */
export const PUBLIC_SITE_BASE = "https://61larus.com";

/**
 * Public entry sayfası URL’si: slug varsa `/{slug}`, yoksa `/?entry=`.
 * SEO yolu: `sitemap` ve yönetici "canlı link" ile aynı kurallar.
 */
export function publicSiteEntryUrl(
  entryId: string,
  entrySlug: string | null | undefined
): string {
  const s = typeof entrySlug === "string" ? entrySlug.trim() : "";
  if (s.length > 0) {
    return `${PUBLIC_SITE_BASE}/${encodeURI(s)}`;
  }
  return `${PUBLIC_SITE_BASE}/?entry=${encodeURIComponent(entryId)}`;
}
