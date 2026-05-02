import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntryRouteLayoutClient } from "@/components/entry-route-layout-client";
import { getCommentAuth } from "@/lib/comment-auth";
import { SITE_BRAND } from "@/lib/entry-seo-metadata";
import { loadApprovedEnglishEntryPublic } from "@/lib/approved-en-entry-public";
import { SITE_ORIGIN } from "@/lib/public-site-entry-url";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  normalizeMetaWhitespace,
  trimMetaDescription,
} from "@/lib/seo-entry-description";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

type PageParams = { slug?: string | string[] };
type PageProps = { params: Promise<PageParams> };

function heroUserDisplayLabel(
  isAuthenticated: boolean,
  email: string | null,
  meta: Record<string, unknown> | null
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

function formatEntryDetailDateEn(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const p = await params;
  const pathSegment = pathSegmentFromParams(p);
  if (!pathSegment) {
    return { title: SITE_BRAND };
  }

  const row = await loadApprovedEnglishEntryPublic(pathSegment);
  if (!row) {
    return { title: SITE_BRAND };
  }

  const pageTitle = `${row.title_en} | ${SITE_BRAND}`;
  const description = trimMetaDescription(
    normalizeMetaWhitespace(row.content_en),
    160
  );
  const trUrl = `${SITE_ORIGIN}/${encodeURI(row.slug)}`;
  const enUrl = `${SITE_ORIGIN}/en/${encodeURI(row.slug)}`;

  return {
    title: pageTitle,
    description: description.length > 0 ? description : undefined,
    robots: { index: true, follow: true },
    alternates: {
      canonical: enUrl,
      languages: {
        tr: trUrl,
        en: enUrl,
      },
    },
    openGraph: {
      title: pageTitle,
      description: description.length > 0 ? description : undefined,
      url: enUrl,
      type: "article",
      siteName: SITE_BRAND,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: description.length > 0 ? description : undefined,
    },
  };
}

export default async function EnglishEntrySlugPage({ params }: PageProps) {
  const p = await params;
  const pathSegment = pathSegmentFromParams(p);
  if (!pathSegment) {
    notFound();
  }

  const [row, auth, headerAuthUser] = await Promise.all([
    loadApprovedEnglishEntryPublic(pathSegment),
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

  if (!row) {
    notFound();
  }

  const heroUserLabel = heroUserDisplayLabel(
    auth.isAuthenticated,
    headerAuthUser.email,
    headerAuthUser.userMetadata
  );

  const formattedDate = row.created_at
    ? formatEntryDetailDateEn(row.created_at)
    : "";

  return (
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
          <div className="relative z-0 max-w-none">
            <div className="entry-detail-back-row flex flex-col gap-0.5 md:flex-row md:items-center md:gap-4">
              <Link
                href="/"
                prefetch
                scroll={false}
                className="entry-detail-back"
              >
                ← Akışa dön
              </Link>
              <Link
                href={`/${encodeURI(row.slug)}`}
                prefetch
                scroll={false}
                className="entry-detail-back"
              >
                Türkçe oku
              </Link>
            </div>

            <article className="entry-detail-article entry-detail-card m-0">
              <header className="m-0 border-0 p-0">
                <h1 id="entry-detail-title-en" className="entry-detail-title">
                  {row.title_en}
                </h1>
                <div className="entry-meta entry-detail-meta">
                  <span className="entry-author">{SITE_BRAND}</span>
                  <span className="entry-dot" aria-hidden>
                    •
                  </span>
                  <span className="entry-date">
                    {formattedDate.length > 0 ? formattedDate : "—"}
                  </span>
                </div>
              </header>
              <section
                aria-labelledby="entry-detail-title-en"
                className="m-0 border-0 p-0"
              >
                <p className="entry-detail-body entry-detail-content">
                  {row.content_en}
                </p>
              </section>
            </article>
          </div>
        </div>
      </div>
    </EntryRouteLayoutClient>
  );
}
