import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { EntryArticleJsonLd } from "@/components/entry-article-json-ld";
import { EntryDetailBodyRsc } from "@/components/entry-detail-body-rsc";
import { EntryRouteLayoutClient } from "@/components/entry-route-layout-client";
import { getEntryDetailBySlug } from "@/lib/entry-route-data";
import { buildEntrySeoMetadata, SITE_BRAND } from "@/lib/entry-seo-metadata";
import { slugifyEntryTitle } from "@/lib/entry-slug";
import { normalizeEntrySlug } from "@/lib/slug";
import { getHomeClientProps } from "@/lib/home-client-props";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

const SITE = "https://61larus.com";

type PageProps = { params: Promise<{ slug: string }> };

function decodeEntryPathSegment(raw: string): string {
  try {
    return decodeURIComponent(raw.trim()).trim();
  } catch {
    return raw.trim();
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: raw } = await params;
  const pathSegment = decodeEntryPathSegment(raw);
  if (!pathSegment) {
    return { robots: { index: false, follow: true } };
  }

  const detail = await getEntryDetailBySlug(raw);
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
  const fromTitle = normalizeEntrySlug(
    (typeof data.title === "string" ? data.title : "").trim()
  );
  const canonicalSlug =
    (typeof s === "string" && s.trim().length > 0
      ? s.trim()
      : fromTitle) ||
    slugifyEntryTitle(
      typeof data.title === "string" ? data.title : "",
      data.id
    ) ||
    pathSegment;
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
  const pathSegment = decodeEntryPathSegment(raw);
  if (!pathSegment) {
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

  const detail = await getEntryDetailBySlug(raw);
  if (!detail) {
    notFound();
  }

  const row = detail.entry;
  const dbSlug =
    typeof row.slug === "string" && row.slug.trim().length > 0
      ? row.slug.trim()
      : null;
  const titleNorm = normalizeEntrySlug(
    (typeof row.title === "string" ? row.title : "").trim()
  );
  const pathFromTitle =
    titleNorm || slugifyEntryTitle(row.title ?? "", row.id);
  const canonicalPath = dbSlug ?? (pathFromTitle || null);
  if (canonicalPath && canonicalPath !== pathSegment) {
    permanentRedirect(`/${encodeURI(canonicalPath)}`);
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
              commentAuth={{
                isAuthenticated: p.isAuthenticated,
                initialAgreementDone: p.initialAgreementDone,
                initialPlatformAccessSuspended:
                  p.initialPlatformAccessSuspended,
              }}
            />
          </div>
        </div>
      </EntryRouteLayoutClient>
    </>
  );
}
