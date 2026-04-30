import type { Metadata } from "next";
import {
  buildEntryMetaDescription,
  entryBodySnippetForMeta,
} from "@/lib/seo-entry-description";

export const SITE_BRAND = "61Larus";
const DEFAULT_TAGLINE = "Trabzon'un gündemi, lafı ve hafızası";

/**
 * Canonical entry sayfaları için ortak: başlık, gövde snippet (önce ~150 karakter),
 * OG article + Twitter summary_large_image.
 */
export function buildEntrySeoMetadata(input: {
  pageTitle: string;
  contentRaw: string;
  entryTitle: string;
  canonical: string;
}): Metadata {
  const fromBody = entryBodySnippetForMeta(input.contentRaw);
  const fallback = buildEntryMetaDescription(
    input.entryTitle,
    input.contentRaw
  );
  const description =
    fromBody.length > 0
      ? fromBody
      : fallback.length > 0
        ? fallback
        : DEFAULT_TAGLINE;

  return {
    title: input.pageTitle,
    description,
    openGraph: {
      title: input.pageTitle,
      description,
      url: input.canonical,
      type: "article",
      siteName: SITE_BRAND,
      locale: "tr_TR",
    },
    twitter: {
      card: "summary_large_image",
      title: input.pageTitle,
      description,
    },
    robots: { index: true, follow: true },
    alternates: { canonical: input.canonical },
  };
}
