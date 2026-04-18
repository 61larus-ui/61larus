export type EntryCategory =
  | "gundem"
  | "mekanlar"
  | "insanlar"
  | "deneyimler"
  | "sorular"
  | "serbest";

export type FeedCategoryFilter = "all" | EntryCategory;

export const FEED_CATEGORY_OPTIONS: readonly {
  readonly id: FeedCategoryFilter;
  readonly label: string;
}[] = [
  { id: "all", label: "Tümü" },
  { id: "gundem", label: "Gündem" },
  { id: "mekanlar", label: "Mekanlar" },
  { id: "insanlar", label: "İnsanlar" },
  { id: "deneyimler", label: "Deneyimler" },
  { id: "sorular", label: "Sorular" },
  { id: "serbest", label: "Serbest" },
] as const;
