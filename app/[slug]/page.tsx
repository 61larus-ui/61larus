import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { EntryArticleJsonLd } from "@/components/entry-article-json-ld";
import { EntryDetailBodyRsc } from "@/components/entry-detail-body-rsc";
import { EntryRouteLayoutClient } from "@/components/entry-route-layout-client";
import {
  getEntryDetailBySlug,
  getEntryRouteDebug,
  type EntryRouteDebug,
} from "@/lib/entry-route-data";
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

function EntrySlugDebugPanel({ debug }: { debug: EntryRouteDebug }) {
  return (
    <div className="entry-slug-debug p-4 font-mono text-sm text-[#101828]">
      <h1 className="mb-4 text-lg font-bold">NOT FOUND DEBUG</h1>
      <section className="mb-6 space-y-2 border-b border-[#E4E7EC] pb-6">
        <p>
          <span className="font-semibold text-[#667085]">Gelen slug: </span>
          <span className="break-all">{debug.incomingSlug}</span>
        </p>
        <p>
          <span className="font-semibold text-[#667085]">Decode edilmiş: </span>
          <span className="break-all">{debug.decodedSlug}</span>
        </p>
        <p>
          <span className="font-semibold text-[#667085]">Normalize (segment): </span>
          <span className="break-all">{debug.normalizedSlug}</span>
        </p>
      </section>
      {debug.recentEntriesError ? (
        <p className="mb-4 text-red-600">
          Son 20 kayıt yüklenemedi: {debug.recentEntriesError}
        </p>
      ) : null}
      <h2 className="mb-2 text-base font-semibold">
        Son 20 entries (Supabase)
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse border border-[#E4E7EC] text-left text-xs">
          <thead className="bg-[#F9FAFB]">
            <tr>
              <th className="border border-[#E4E7EC] p-2 font-semibold">
                id
              </th>
              <th className="border border-[#E4E7EC] p-2 font-semibold">
                title
              </th>
              <th className="border border-[#E4E7EC] p-2 font-semibold">
                slug
              </th>
              <th className="border border-[#E4E7EC] p-2 font-semibold">
                normalizeEntrySlug(title)
              </th>
            </tr>
          </thead>
          <tbody>
            {debug.recentEntries.map((r) => (
              <tr key={r.id}>
                <td className="border border-[#E4E7EC] p-2 align-top break-all">
                  {r.id}
                </td>
                <td className="border border-[#E4E7EC] p-2 align-top break-words">
                  {r.title ?? "—"}
                </td>
                <td className="border border-[#E4E7EC] p-2 align-top break-all">
                  {r.slug ?? "—"}
                </td>
                <td className="border border-[#E4E7EC] p-2 align-top break-all">
                  {r.normalizedTitleSlug || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
    segment;
  const canonical = `${SITE}/${encodeURI(canonicalSlug)}`;

  return buildEntrySeoMetadata({
    pageTitle,
    contentRaw,
    entryTitle,
    canonical,
  });
}

export default async function EntrySlugPage({ params }: PageProps) {
  const resolved = await params;
  console.log("SLUG:", resolved.slug);

  const raw = resolved.slug;
  let slug: string;
  try {
    slug = decodeURIComponent(raw).trim();
  } catch {
    slug = raw.trim();
  }
  if (!slug) {
    const debug = await getEntryRouteDebug(raw);
    return <EntrySlugDebugPanel debug={debug} />;
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

  const detail = await getEntryDetailBySlug(slug);
  if (!detail) {
    const debug = await getEntryRouteDebug(raw);
    return <EntrySlugDebugPanel debug={debug} />;
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
  if (canonicalPath && canonicalPath !== slug) {
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
            />
          </div>
        </div>
      </EntryRouteLayoutClient>
    </>
  );
}
