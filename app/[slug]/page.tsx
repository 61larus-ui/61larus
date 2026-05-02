import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { EntryArticleJsonLd } from "@/components/entry-article-json-ld";
import { EntryDetailBodyRsc } from "@/components/entry-detail-body-rsc";
import { EntryDetailCommentsRsc } from "@/components/entry-detail-comments-rsc";
import { RelatedEntries } from "@/components/related-entries";
import { EntryRouteLayoutClient } from "@/components/entry-route-layout-client";
import { getCommentAuth } from "@/lib/comment-auth";
import type { EntryItem } from "@/app/home-page-client";
import { getRelatedEntrySummaries, loadEntryPageShell } from "@/lib/entry-route-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { buildEntrySeoMetadata, SITE_BRAND } from "@/lib/entry-seo-metadata";
import { SITE_ORIGIN } from "@/lib/public-site-entry-url";
import { slugifyEntryTitle } from "@/lib/entry-slug";
import { normalizeEntrySlug } from "@/lib/slug";

/** Entry: loadEntryPageShell → decode+trim, tam slug eşlemesi veya UUID id (entry-route-data). */

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

type PageParams = { slug?: string | string[] };
type PageProps = { params: Promise<PageParams> };

function heroUserDisplayLabel(
  isAuthenticated: boolean,
  email: string | null,
  meta: Record<string, unknown> | null,
): string {
  if (!isAuthenticated) return "";
  const full =
    meta && typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  const name = meta && typeof meta.name === "string" ? meta.name.trim() : "";
  if (full) return full;
  if (name) return name;
  if (email?.trim()) {
    return email.split("@")[0]?.trim() || "\u2026";
  }
  return "\u2026";
}

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
  const canonical = `${SITE_ORIGIN}/${encodeURI(canonicalSlug)}`;

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

  const relatedEntries = await getRelatedEntrySummaries(entryRow.id, entryRow.category);

  const heroUserLabel = heroUserDisplayLabel(
    auth.isAuthenticated,
    headerAuthUser.email,
    headerAuthUser.userMetadata,
  );

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
          <header className="site-header site-header--home-faz83 site-header--trabzon-header home-header-banner relative z-20 shrink-0">
            <div className="home-hero-visual">
              <img
                src="/trabzon-gece-hafiza-banner.png"
                alt="Trabzon gece panoraması"
                className="home-hero-visual__image"
              />
              <div className="home-hero-visual__shade" aria-hidden="true" />
              <div
                className="absolute inset-0 z-[2] bg-black/50 md:bg-black/40 pointer-events-none rounded-[16px]"
                aria-hidden="true"
              />
              <div className="home-hero-content z-10 max-w-[420px] text-white">
                <h1 className="home-hero-title">
                  <Link
                    href="/"
                    prefetch
                    scroll={false}
                    className="site-wordmark font-bold transition-opacity duration-200 hover:opacity-88"
                    style={{ fontFeatureSettings: '"ss01" 1, "cv01" 1' }}
                    aria-label="Ana sayfa — Akış"
                  >
                    {SITE_BRAND}
                  </Link>
                </h1>
                <div className="home-hero-accent-line" aria-hidden="true" />
                <p className="home-hero-tagline">
                  Trabzon&apos;un gündemi,{" "}
                  <span>lafı ve hafızası</span>
                </p>
              </div>

              <div className="home-hero-user z-10">
                {!auth.isAuthenticated ? (
                  <Link href="/auth" prefetch className="!text-white">
                    Giriş
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/katkilarim"
                      prefetch
                      scroll={false}
                      className="site-account-link shrink-0 !text-white"
                    >
                      Katkılarım
                    </Link>
                    <div className="relative z-30 min-w-0 shrink-0">
                      <button
                        type="button"
                        className="account-menu-name-trigger max-w-full cursor-pointer border-0 bg-transparent p-0 !text-white"
                        style={{ WebkitTapHighlightColor: "transparent" }}
                        aria-haspopup="menu"
                        aria-expanded={false}
                        aria-label="Hesap menüsü"
                      >
                        <div
                          className="account-menu-trigger-inner flex min-h-9 w-full max-w-none items-center justify-center overflow-visible rounded-md px-0.5 py-0 md:min-h-8 md:justify-end"
                          style={{
                            transition: "var(--transition)",
                          }}
                        >
                          <span className="site-account-name account-menu-handle header-user mobileHeaderUserName block whitespace-nowrap text-right !text-white">
                            {heroUserLabel}
                          </span>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>
          <div className="entry-detail-page-inner">
            <EntryDetailBodyRsc
              entry={entrySafe}
              commentAuth={{
                isAuthenticated: auth.isAuthenticated,
                initialAgreementDone: auth.agreementAccepted,
                initialPlatformAccessSuspended: auth.isSuspended,
              }}
              commentsSlot={<EntryDetailCommentsRsc row={entryRow} />}
              relatedSlot={<RelatedEntries items={relatedEntries} />}
            />
          </div>
        </div>
      </EntryRouteLayoutClient>
    </>
  );
}
