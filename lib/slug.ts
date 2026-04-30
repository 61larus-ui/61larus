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

/**
 * Canonical DB slug base from entry title. Uses {@link normalizeEntrySlug};
 * if empty, falls back to first 8 hex chars of id, or `"entry"`.
 */
export function slugifyEntryTitle(title: string, idForFallback: string): string {
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

/** Same root normalization as {@link ensureUniqueEntrySlug} in entry-slug. */
export function entrySlugRootFromBase(baseSlug: string): string {
  return (baseSlug || "entry").replace(/^-+|-+$/g, "") || "entry";
}

/**
 * Next unique slug: `root`, then `root-2`, `root-3`, … (in-memory, matches DB resolver).
 */
export function allocateUniqueSlug(root: string, taken: Set<string>): string {
  const r = entrySlugRootFromBase(root);
  let n = 0;
  for (;;) {
    const candidate = n === 0 ? r : `${r}-${n + 1}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
    n += 1;
    if (n > 10_000) {
      throw new Error("slug_allocation_exhausted");
    }
  }
}
