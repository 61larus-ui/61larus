import type { Metadata } from "next";
import { unstable_noStore } from "next/cache";
import { Suspense, cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { EntryArticleJsonLd } from "@/components/entry-article-json-ld";
import { EntryDetailBodyRsc } from "@/components/entry-detail-body-rsc";
import { EntryDetailCommentsRsc } from "@/components/entry-detail-comments-rsc";
import { EntryRouteLayoutClient } from "@/components/entry-route-layout-client";
import { getCommentAuth } from "@/lib/comment-auth";
import {
  buildEntryItemFast,
  getEntryByResolvedSlug,
} from "@/lib/entry-route-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { buildEntrySeoMetadata, SITE_BRAND } from "@/lib/entry-seo-metadata";
import { slugifyEntryTitle } from "@/lib/entry-slug";
import { normalizeEntrySlug } from "@/lib/slug";

/** Entry slug: doğrudan slug → UUID → başlık normalizasyonu (getEntryByResolvedSlug). */

type DbClient = NonNullable<
  Awaited<ReturnType<typeof createSupabaseServerClient>>
>;

const loadEntryPageData = cache(async (raw: string) => {
  unstable_noStore();
  const pathSegment = decodeEntryPathSegment(raw);
  if (!pathSegment) return null;
  const supabase = await createSupabaseServerClient();
  const client = (createSupabaseServiceClient() ?? supabase) as DbClient;
  const row = await getEntryByResolvedSlug(client, pathSegment);
  if (!row) return null;
  const entry = await buildEntryItemFast(supabase, row);
  return { entry, row };
});

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

function EntryDetailCommentsFallback() {
  return (
    <section className="entry-comments-section" aria-label="Yorumlar" aria-busy>
      <p className="entry-detail-loading m-0">Yorumlar yükleniyor…</p>
    </section>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: raw } = await params;
  const pathSegment = decodeEntryPathSegment(raw);
  if (!pathSegment) {
    return { robots: { index: false, follow: true } };
  }

  const shell = await loadEntryPageData(raw);
  if (!shell) {
    return { robots: { index: false, follow: true } };
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

  const [shell, auth, headerAuthUser] = await Promise.all([
    // loadEntryPageData: React.cache ile generateMetadata ile aynı istekte tek kez çalışır
    loadEntryPageData(raw),
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
  const dbSlug =
    typeof entry.slug === "string" && entry.slug.trim().length > 0
      ? entry.slug.trim()
      : null;
  const titleNorm = normalizeEntrySlug(
    (typeof entry.title === "string" ? entry.title : "").trim()
  );
  const pathFromTitle =
    titleNorm || slugifyEntryTitle(entry.title ?? "", entry.id);
  const canonicalPath = dbSlug ?? (pathFromTitle || null);
  if (canonicalPath && canonicalPath !== pathSegment) {
    permanentRedirect(`/${encodeURI(canonicalPath)}`);
  }

  return (
    <>
      <EntryArticleJsonLd
        title={entry.title}
        content={entry.content}
        createdAt={entry.created_at != null ? String(entry.created_at) : null}
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
              entry={entry}
              commentAuth={{
                isAuthenticated: auth.isAuthenticated,
                initialAgreementDone: auth.agreementAccepted,
                initialPlatformAccessSuspended: auth.isSuspended,
              }}
              commentsSlot={
                <Suspense fallback={<EntryDetailCommentsFallback />}>
                  <EntryDetailCommentsRsc row={entryRow} />
                </Suspense>
              }
            />
          </div>
        </div>
      </EntryRouteLayoutClient>
    </>
  );
}
