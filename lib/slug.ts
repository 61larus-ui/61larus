/**
 * Turkish-aware ASCII slug from free text (title or segment).
 * ç→c, ğ→g, ı/İ→i, ö→o, ş→s, ü→u; non-alnum → single hyphen; trim.
 * Returns "" if nothing useful remains (caller may fall back, e.g. id-based).
 */
export function normalizeEntrySlug(input: string): string {
  let s = input.normalize("NFC");
  const mapPairs: [string, string][] = [
    ["Ç", "c"],
    ["ç", "c"],
    ["Ğ", "g"],
    ["ğ", "g"],
    ["İ", "i"],
    ["I", "i"],
    ["ı", "i"],
    ["Ö", "o"],
    ["ö", "o"],
    ["Ş", "s"],
    ["ş", "s"],
    ["Ü", "u"],
    ["ü", "u"],
  ];
  for (const [a, b] of mapPairs) {
    s = s.split(a).join(b);
  }
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
