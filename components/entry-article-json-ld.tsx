import {
  buildEntryMetaDescription,
  entryBodySnippetForMeta,
} from "@/lib/seo-entry-description";
import { SITE_BRAND } from "@/lib/entry-seo-metadata";

type Props = {
  title: string | null;
  content: string | null;
  createdAt: string | null;
};

/**
 * Article JSON-LD — yalnızca geçerli yayın tarihi ve en az başlık veya gövde varken render eder.
 * Next App Router: sayfa gövdesinde; JSON-LD script etiketi geçerlidir.
 */
export function EntryArticleJsonLd({ title, content, createdAt }: Props) {
  const entryTitle = typeof title === "string" ? title.trim() : "";
  const contentRaw = typeof content === "string" ? content : "";
  if (!entryTitle && !contentRaw.trim()) {
    return null;
  }
  if (createdAt == null || String(createdAt).length === 0) {
    return null;
  }
  const published = new Date(createdAt);
  if (Number.isNaN(published.getTime())) {
    return null;
  }
  const fromBody = entryBodySnippetForMeta(contentRaw);
  const fallback = buildEntryMetaDescription(entryTitle, contentRaw);
  const descriptionSource =
    fromBody.length > 0
      ? fromBody
      : fallback.length > 0
        ? fallback
        : null;
  if (descriptionSource == null && !entryTitle) {
    return null;
  }
  const headline = entryTitle.length > 0 ? entryTitle : SITE_BRAND;
  const description = descriptionSource ?? entryTitle;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    datePublished: published.toISOString(),
    author: {
      "@type": "Organization",
      name: "61Larus",
    },
  } as const;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
