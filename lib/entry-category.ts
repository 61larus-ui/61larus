export type EntryCategory =
  | "gundem"
  | "sahsiyetler"
  | "mahalleler"
  | "sehir-hafizasi"
  | "gundelik-hayat"
  | "tarih"
  | "yerel-lezzetler"
  | "cografya"
  | "yurttaslik-bilgisi"
  | "spor";

export type FeedCategoryFilter = "all" | EntryCategory;

export const FEED_CATEGORY_OPTIONS: readonly {
  readonly id: FeedCategoryFilter;
  readonly label: string;
}[] = [
  { id: "all", label: "Tümü" },
  { id: "gundem", label: "Gündem" },
  { id: "sahsiyetler", label: "Şahsiyetler" },
  { id: "mahalleler", label: "Mahalleler" },
  { id: "sehir-hafizasi", label: "Şehir hafızası" },
  { id: "gundelik-hayat", label: "Gündelik hayat" },
  { id: "tarih", label: "Trabzon Tarihi" },
  { id: "yerel-lezzetler", label: "Yerel lezzetler" },
  { id: "cografya", label: "Coğrafya" },
  { id: "yurttaslik-bilgisi", label: "Yurttaşlık Bilgisi" },
  { id: "spor", label: "Spor" },
] as const;

/** Görünen label (UI / yanlışlıkla DB’ye yazılmış) → kanonik slug. */
const CATEGORY_LABEL_TO_SLUG: Record<string, EntryCategory> = (() => {
  const m: Record<string, EntryCategory> = {};
  for (const o of FEED_CATEGORY_OPTIONS) {
    if (o.id !== "all") {
      m[o.id] = o.id;
      m[o.label] = o.id;
      m[o.label.toLocaleLowerCase("tr-TR")] = o.id;
    }
  }
  return m;
})();

/** Eski slug / legacy → tek tip `EntryCategory` (DB + eski veri). */
const LEGACY_ENTRY_CATEGORY_MAP: Record<string, EntryCategory> = {
  Tarih: "tarih",
  mekanlar: "mahalleler",
  insanlar: "sahsiyetler",
  deneyimler: "yerel-lezzetler",
  sorular: "yurttaslik-bilgisi",
  serbest: "cografya",
  mektephayati: "yerel-lezzetler",
  "mektep-hayati": "yerel-lezzetler",
  yurttaslik_bilgisi: "yurttaslik-bilgisi",
};

const CANONICAL_SLUG_LOWER: Record<string, EntryCategory> = {
  gundem: "gundem",
  sahsiyetler: "sahsiyetler",
  mahalleler: "mahalleler",
  "sehir-hafizasi": "sehir-hafizasi",
  "gundelik-hayat": "gundelik-hayat",
  tarih: "tarih",
  "yerel-lezzetler": "yerel-lezzetler",
  cografya: "cografya",
  "yurttaslik-bilgisi": "yurttaslik-bilgisi",
  spor: "spor",
};

/**
 * DB’den gelen category string’ini kanonik `EntryCategory` slug’ına indirger.
 * Label, legacy slug veya büyük/küçük harf varyantlarını kabul eder.
 */
export function normalizeEntryCategory(
  raw: string | null | undefined
): EntryCategory | null {
  if (raw == null || typeof raw !== "string") return null;
  let t = raw.trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
  t = t.replace(/\s+/g, " ");
  try {
    t = t.normalize("NFC");
  } catch {
    /* ignore */
  }
  if (t.length === 0) return null;

  const fromLabel = CATEGORY_LABEL_TO_SLUG[t];
  if (fromLabel) return fromLabel;

  const legacy = LEGACY_ENTRY_CATEGORY_MAP[t];
  if (legacy) return legacy;

  const lower = t.toLowerCase();
  const fromLower = LEGACY_ENTRY_CATEGORY_MAP[lower];
  if (fromLower) return fromLower;

  const canonical = CANONICAL_SLUG_LOWER[lower] ?? CANONICAL_SLUG_LOWER[t];
  if (canonical) return canonical;

  return null;
}
