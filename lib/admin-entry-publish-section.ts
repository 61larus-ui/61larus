/**
 * Admin panel: entry `category` kolonunda saklanan yayın alanı slug’ları.
 * (Ana sayfa veri mantığı bu dosyayı kullanmaz.)
 */
export const ADMIN_ENTRY_PUBLISH_SECTION_SLUGS = [
  "pending",
  "trending",
  "memory",
  "today",
  "understand_trabzon",
  "question_of_day",
] as const;

export type AdminEntryPublishSectionSlug =
  (typeof ADMIN_ENTRY_PUBLISH_SECTION_SLUGS)[number];

export const ADMIN_ENTRY_PUBLISH_SECTION_OPTIONS: readonly {
  readonly slug: AdminEntryPublishSectionSlug;
  readonly label: string;
}[] = [
  { slug: "pending", label: "Yazılmayı bekleyenler" },
  { slug: "trending", label: "Şu an en çok konuşulanlar" },
  { slug: "memory", label: "Hafızaya eklenenler" },
  { slug: "today", label: "Bugün 61Larus’ta" },
  { slug: "understand_trabzon", label: "Trabzon’u anlamak için" },
  { slug: "question_of_day", label: "Günün sorusu" },
];

const SLUG_SET = new Set<string>(ADMIN_ENTRY_PUBLISH_SECTION_SLUGS);

export function normalizeAdminEntryPublishSection(
  raw: string | null | undefined
): AdminEntryPublishSectionSlug | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  if (SLUG_SET.has(t)) return t as AdminEntryPublishSectionSlug;
  return null;
}

export function adminEntryPublishSectionLabel(
  slug: string | null | undefined
): string {
  if (!slug) return "—";
  const o = ADMIN_ENTRY_PUBLISH_SECTION_OPTIONS.find((x) => x.slug === slug);
  return o?.label ?? slug;
}
