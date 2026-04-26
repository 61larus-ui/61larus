import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { EntryArticleJsonLd } from "@/components/entry-article-json-ld";
import { EntryDetailBodyRsc } from "@/components/entry-detail-body-rsc";
import { EntryRouteLayoutClient } from "@/components/entry-route-layout-client";
import { getEntryDetailBySlug } from "@/lib/entry-route-data";
import { buildEntrySeoMetadata, SITE_BRAND } from "@/lib/entry-seo-metadata";
import { getHomeClientProps } from "@/lib/home-client-props";

export const dynamic = "force-dynamic";

const SITE = "https://61larus.com";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: raw } = await params;
  const segment = decodeURIComponent(raw).trim();
  if (!segment) {
    return { robots: { index: false, follow: true } };
  }

  const detail = await getEntryDetailBySlug(segment);
  if (!detail) {
    return { robots: { index: false, follow: true } };
  }

  const data = detail.entry;
  const titleRaw = typeof data.title === "string" ? data.title : "";
  const contentRaw = typeof data.content === "string" ? data.content : "";
  const entryTitle = titleRaw.trim();
  const pageTitle =
    entryTitle.length > 0 ? `${entryTitle} | ${SITE_BRAND}` : SITE_BRAND;
  const s = data.slug;
  const canonicalSlug =
    typeof s === "string" && s.trim().length > 0 ? s.trim() : segment;
  const canonical = `${SITE}/${encodeURI(canonicalSlug)}`;

  return buildEntrySeoMetadata({
    pageTitle,
    contentRaw,
    entryTitle,
    canonical,
  });
}

export default async function EntrySlugPage({ params }: PageProps) {
  const { slug: raw } = await params;
  const segment = decodeURIComponent(raw).trim();
  if (!segment) {
    notFound();
  }

  const home = await getHomeClientProps();
  if (!home.ok) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12">
        <p className="max-w-md text-center text-sm leading-6 text-[#667085]">
          Hata: {home.message}
        </p>
      </div>
    );
  }

  const detail = await getEntryDetailBySlug(segment);
  if (!detail) {
    notFound();
  }

  const row = detail.entry;
  if (
    typeof row.slug === "string" &&
    row.slug.trim() &&
    row.slug.trim() !== segment
  ) {
    permanentRedirect(`/${encodeURI(row.slug.trim())}`);
  }

  const p = home.props;

  return (
    <>
      <EntryArticleJsonLd
        title={row.title}
        content={row.content}
        createdAt={
          row.created_at != null ? String(row.created_at) : null
        }
      />
      <EntryRouteLayoutClient
        isAuthenticated={p.isAuthenticated}
        userEmail={p.userEmail}
        initialPlatformAccessSuspended={p.initialPlatformAccessSuspended}
      >
        <div className="entry-detail-page">
          <div className="entry-detail-page-inner">
            <EntryDetailBodyRsc
              entry={row}
              comments={detail.comments}
            />
          </div>
        </div>
      </EntryRouteLayoutClient>
    </>
  );
}
