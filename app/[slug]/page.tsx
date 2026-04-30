import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { EntryArticleJsonLd } from "@/components/entry-article-json-ld";
import { EntryDetailBodyRsc } from "@/components/entry-detail-body-rsc";
import { EntryDetailCommentsRsc } from "@/components/entry-detail-comments-rsc";
import { EntryRouteLayoutClient } from "@/components/entry-route-layout-client";
import { getCommentAuth } from "@/lib/comment-auth";
import type { EntryItem } from "@/app/home-page-client";
import { loadEntryPageShell } from "@/lib/entry-route-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { buildEntrySeoMetadata, SITE_BRAND } from "@/lib/entry-seo-metadata";
import { slugifyEntryTitle } from "@/lib/entry-slug";
import { normalizeEntrySlug } from "@/lib/slug";

/** Entry: loadEntryPageShell → decode+trim, tam slug eşlemesi veya UUID id (entry-route-data). */

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

const SITE = "https://61larus.com";

type PageParams = { slug?: string | string[] };
type PageProps = { params: Promise<PageParams> };

function pathSegmentFromParams(p: PageParams): string | null {
  const rawSlug = Array.isArray(p.slug) ? p.slug[0] : p.slug;
  try {
    const pathSegment = decodeURIComponent(rawSlug ?? "").trim();
    return pathSegment.length > 0 ? pathSegment : null;
  } catch {
    const pathSegment = String(rawSlug ?? "").trim();
    return pathSegment.length > 0 ? pathSegment : null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const p = await params;
  const pathSegment = pathSegmentFromParams(p);
  if (!pathSegment) {
    return { title: SITE_BRAND };
  }

  const shell = await loadEntryPageShell(pathSegment);
  if (!shell) {
    return { title: SITE_BRAND };
  }

  const data = shell.entry;
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
    (typeof s === "string" && s.trim().length > 0 ? s.trim() : fromTitle) ||
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
  const p = await params;
  const pathSegment = pathSegmentFromParams(p);
  if (!pathSegment) {
    notFound();
  }

  const [shell, auth, headerAuthUser] = await Promise.all([
    loadEntryPageShell(pathSegment),
    getCommentAuth(),
    (async () => {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const meta = user?.user_metadata;
      return {
        email: user?.email ?? null,
        userMetadata:
          meta && typeof meta === "object" && !Array.isArray(meta)
            ? (meta as Record<string, unknown>)
            : null,
      };
    })(),
  ]);

  if (!shell) {
    notFound();
  }

  const { entry, row: entryRow } = shell;

  const rowSlug =
    typeof entryRow.slug === "string" && entryRow.slug.trim().length > 0
      ? entryRow.slug.trim()
      : null;
  const entrySafe: EntryItem = {
    ...entry,
    id: entry.id ?? entryRow.id,
    title:
      typeof entry.title === "string" && entry.title.trim().length > 0
        ? entry.title
        : typeof entryRow.title === "string"
          ? entryRow.title
          : "",
    content:
      typeof entry.content === "string"
        ? entry.content
        : typeof entryRow.content === "string"
          ? entryRow.content
          : "",
    created_at:
      typeof entry.created_at === "string" && entry.created_at.length > 0
        ? entry.created_at
        : typeof entryRow.created_at === "string"
          ? entryRow.created_at
          : "",
    slug: entry.slug ?? rowSlug,
  };

  const dbSlug =
    typeof entrySafe.slug === "string" && entrySafe.slug.trim().length > 0
      ? entrySafe.slug.trim()
      : null;
  const titleNorm = normalizeEntrySlug(
    (typeof entrySafe.title === "string" ? entrySafe.title : "").trim()
  );
  const pathFromTitle =
    titleNorm || slugifyEntryTitle(entrySafe.title ?? "", entrySafe.id);
  const canonicalPath = dbSlug ?? (pathFromTitle || null);
  if (canonicalPath && canonicalPath !== pathSegment) {
    permanentRedirect(`/${encodeURI(canonicalPath)}`);
  }

  return (
    <>
      <div style={{ display: "none" }} data-entry-detail-loaded="true">
        {entrySafe.id}
      </div>
      <EntryArticleJsonLd
        title={entrySafe.title}
        content={entrySafe.content}
        createdAt={
          entrySafe.created_at != null ? String(entrySafe.created_at) : null
        }
      />
      <EntryRouteLayoutClient
        isAuthenticated={auth.isAuthenticated}
        userEmail={headerAuthUser.email}
        userMetadata={headerAuthUser.userMetadata}
        initialPlatformAccessSuspended={auth.isSuspended}
      >
        <div className="entry-detail-page">
          <div className="entry-detail-page-inner">
            <EntryDetailBodyRsc
              entry={entrySafe}
              commentAuth={{
                isAuthenticated: auth.isAuthenticated,
                initialAgreementDone: auth.agreementAccepted,
                initialPlatformAccessSuspended: auth.isSuspended,
              }}
              commentsSlot={<EntryDetailCommentsRsc row={entryRow} />}
            />
          </div>
        </div>
      </EntryRouteLayoutClient>
    </>
  );
}
