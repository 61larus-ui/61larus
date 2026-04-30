import { slugifyEntryTitle } from "@/lib/entry-slug";
import { normalizeEntrySlug } from "@/lib/slug";

export function entryPathSegmentForUrl(
  slug: string | null | undefined,
  title: string | null | undefined,
  id: string
): string {
  const s =
    typeof slug === "string" && slug.trim().length > 0 ? slug.trim() : "";
  if (s.length > 0) return s;
  const t = typeof title === "string" ? title : "";
  return normalizeEntrySlug(t.trim()) || slugifyEntryTitle(t, id);
}

export type EntryRowLite = {
  id: string;
  title: string | null;
  slug: string | null;
  created_at: string;
};

export function entryDetailHref(row: EntryRowLite): string {
  const segment = entryPathSegmentForUrl(row.slug, row.title, row.id);
  return `/${encodeURI(segment)}`;
}

export function formatCommentDateTr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
