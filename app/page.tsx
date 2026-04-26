import type { Metadata } from "next";
import { Suspense } from "react";
import { permanentRedirect } from "next/navigation";
import { EntryArticleJsonLd } from "@/components/entry-article-json-ld";
import { EntryDetailBodyRsc } from "@/components/entry-detail-body-rsc";
import { EntryRouteLayoutClient } from "@/components/entry-route-layout-client";
import HomePageClient from "./home-page-client";
import { buildEntrySeoMetadata, SITE_BRAND } from "@/lib/entry-seo-metadata";
import { getEntryDetailById } from "@/lib/entry-route-data";
import { isRfc4122Uuid } from "@/lib/seo-entry-description";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { getHomeClientProps } from "@/lib/home-client-props";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE = "https://61larus.com";
const DEFAULT_HOME_DESCRIPTION = "Trabzon'un gündemi, lafı ve hafızası";

const defaultHomeMetadata = (): Metadata => ({
  title: SITE_BRAND,
  description: DEFAULT_HOME_DESCRIPTION,
  openGraph: {
    title: SITE_BRAND,
    description: DEFAULT_HOME_DESCRIPTION,
    url: SITE,
    type: "website",
    siteName: SITE_BRAND,
    locale: "tr_TR",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_BRAND,
    description: DEFAULT_HOME_DESCRIPTION,
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE },
});

type HomePageSearchParams = Promise<{
  entry?: string | string[];
}>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: HomePageSearchParams;
}): Promise<Metadata> {
  const params = await searchParams;
  const raw = params.entry;
  const entryParam = Array.isArray(raw) ? raw[0] : raw;
  if (entryParam == null || typeof entryParam !== "string") {
    return defaultHomeMetadata();
  }

  const id = decodeURIComponent(entryParam.trim());
  if (!isRfc4122Uuid(id)) {
    return {
      ...defaultHomeMetadata(),
      robots: { index: false, follow: true },
    };
  }

  const supabase = await createSupabaseServerClient();
  const entriesClient = createSupabaseServiceClient() ?? supabase;
  let data: {
    id: string;
    title: string | null;
    content: string | null;
    slug?: string | null;
  } | null = null;
  {
    const full = await entriesClient
      .from("entries")
      .select("id, title, content, slug")
      .eq("id", id)
      .maybeSingle();
    if (full.data && !full.error) {
      data = full.data;
    } else if (
      full.error &&
      /slug|column|schema|not exist/i.test(full.error.message ?? "")
    ) {
      const fb = await entriesClient
        .from("entries")
        .select("id, title, content")
        .eq("id", id)
        .maybeSingle();
      data = fb.data ?? null;
    } else {
      data = full.data ?? null;
    }
  }

  if (!data) {
    return {
      ...defaultHomeMetadata(),
      robots: { index: false, follow: true },
    };
  }

  const titleRaw = typeof data.title === "string" ? data.title : "";
  const contentRaw = typeof data.content === "string" ? data.content : "";
  const entryTitle = titleRaw.trim();
  const pageTitle =
    entryTitle.length > 0 ? `${entryTitle} | ${SITE_BRAND}` : SITE_BRAND;
  const slugFromRow =
    typeof data.slug === "string" && data.slug.trim().length > 0
      ? data.slug.trim()
      : null;
  const canonical = slugFromRow
    ? `${SITE}/${slugFromRow}`
    : `${SITE}/?entry=${id}`;

  return buildEntrySeoMetadata({
    pageTitle,
    contentRaw,
    entryTitle,
    canonical,
  });
}

export default async function Home({
  searchParams,
}: {
  searchParams: HomePageSearchParams;
}) {
  const params = await searchParams;
  const raw = params.entry;
  const entryParam = Array.isArray(raw) ? raw[0] : raw;

  if (entryParam != null && typeof entryParam === "string") {
    const id = decodeURIComponent(entryParam.trim());
    if (isRfc4122Uuid(id)) {
      const supabase = await createSupabaseServerClient();
      const entriesClient = createSupabaseServiceClient() ?? supabase;
      const full = await entriesClient
        .from("entries")
        .select("slug, title, content, created_at")
        .eq("id", id)
        .maybeSingle();

      type QueryRow = {
        slug?: string | null;
        title: string | null;
        content: string | null;
        created_at: string | null;
      };
      let row: QueryRow | null = null;
      if (full.data && !full.error) {
        row = full.data as QueryRow;
      } else if (
        full.error &&
        /slug|column|schema|not exist/i.test(full.error.message ?? "")
      ) {
        const fb = await entriesClient
          .from("entries")
          .select("title, content, created_at")
          .eq("id", id)
          .maybeSingle();
        if (fb.data && !fb.error) {
          const r = fb.data as {
            title: string | null;
            content: string | null;
            created_at: string | null;
          };
          row = { ...r, slug: null };
        }
      } else {
        row = (full.data as QueryRow) ?? null;
      }

      if (row) {
        const s = row.slug;
        if (typeof s === "string" && s.trim().length > 0) {
          permanentRedirect(`/${s.trim()}`);
        }
        const detail = await getEntryDetailById(id);
        const result = await getHomeClientProps();
        if (!result.ok) {
          return (
            <div className="flex flex-1 flex-col items-center justify-center py-12">
              <p className="max-w-md text-center text-sm leading-6 text-[#667085]">
                Hata: {result.message}
              </p>
            </div>
          );
        }
        if (detail) {
          const p = result.props;
          return (
            <>
              <EntryArticleJsonLd
                title={detail.entry.title}
                content={detail.entry.content}
                createdAt={
                  detail.entry.created_at != null
                    ? String(detail.entry.created_at)
                    : null
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
                      entry={detail.entry}
                      comments={detail.comments}
                    />
                  </div>
                </div>
              </EntryRouteLayoutClient>
            </>
          );
        }
      }
    }
  }

  const result = await getHomeClientProps();
  if (!result.ok) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12">
        <p className="max-w-md text-center text-sm leading-6 text-[#667085]">
          Hata: {result.message}
        </p>
      </div>
    );
  }
  return (
    <Suspense fallback={null}>
      <HomePageClient {...result.props} />
    </Suspense>
  );
}
