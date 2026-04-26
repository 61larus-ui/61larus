import type { Metadata } from "next";
import { Suspense } from "react";
import { permanentRedirect } from "next/navigation";
import HomePageClient from "./home-page-client";
import { buildEntrySeoMetadata, SITE_BRAND } from "@/lib/entry-seo-metadata";
import { slugifyEntryTitle } from "@/lib/entry-slug";
import { normalizeEntrySlug } from "@/lib/slug";
import { isRfc4122Uuid } from "@/lib/seo-entry-description";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { getHomeClientProps } from "@/lib/home-client-props";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE = "https://61larus.com";
const DEFAULT_HOME_DESCRIPTION = "Trabzon'un gündemi, lafı ve hafızası";

function entryPathSegmentForUrl(
  slug: string | null | undefined,
  title: string | null | undefined,
  id: string
): string {
  const s = typeof slug === "string" && slug.trim().length > 0 ? slug.trim() : "";
  if (s.length > 0) return s;
  const t = typeof title === "string" ? title : "";
  return (
    normalizeEntrySlug(t.trim()) || slugifyEntryTitle(t, id)
  );
}

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
  const pathSegment = entryPathSegmentForUrl(data.slug, data.title, data.id);
  const canonical = `${SITE}/${pathSegment}`;

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
        .select("slug, title")
        .eq("id", id)
        .maybeSingle();

      type QueryRow = { slug?: string | null; title: string | null };
      let row: QueryRow | null = null;
      if (full.data && !full.error) {
        row = full.data as QueryRow;
      } else if (
        full.error &&
        /slug|column|schema|not exist/i.test(full.error.message ?? "")
      ) {
        const fb = await entriesClient
          .from("entries")
          .select("title")
          .eq("id", id)
          .maybeSingle();
        if (fb.data && !fb.error) {
          row = { ...(fb.data as { title: string | null }), slug: null };
        }
      } else {
        row = (full.data as QueryRow) ?? null;
      }

      if (row) {
        const pathSlug = entryPathSegmentForUrl(row.slug, row.title, id);
        permanentRedirect(`/${encodeURI(pathSlug)}`);
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
