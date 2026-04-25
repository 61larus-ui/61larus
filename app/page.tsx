import type { Metadata } from "next";
import { Suspense } from "react";
import { permanentRedirect } from "next/navigation";
import HomePageClient from "./home-page-client";
import {
  buildEntryMetaDescription,
  isRfc4122Uuid,
} from "@/lib/seo-entry-description";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { getHomeClientProps } from "@/lib/home-client-props";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE = "https://61larus.com";
const SITE_LABEL = "61LARUS";

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
    return {};
  }

  const id = decodeURIComponent(entryParam.trim());
  if (!isRfc4122Uuid(id)) {
    return {
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
      robots: { index: false, follow: true },
    };
  }

  const titleRaw = typeof data.title === "string" ? data.title : "";
  const contentRaw = typeof data.content === "string" ? data.content : "";
  const entryTitle = titleRaw.trim();
  const description = buildEntryMetaDescription(entryTitle, contentRaw);
  const pageTitle =
    entryTitle.length > 0 ? `${entryTitle} | ${SITE_LABEL}` : SITE_LABEL;
  const slugFromRow =
    typeof data.slug === "string" && data.slug.trim().length > 0
      ? data.slug.trim()
      : null;
  const canonical = slugFromRow
    ? `${SITE}/${slugFromRow}`
    : `${SITE}/?entry=${id}`;

  return {
    title: pageTitle,
    description: description.length > 0 ? description : undefined,
    openGraph: {
      title: pageTitle,
      description: description.length > 0 ? description : undefined,
      url: canonical,
    },
    twitter: {
      card: "summary",
      title: pageTitle,
      description: description.length > 0 ? description : undefined,
    },
    robots: { index: true, follow: true },
    alternates: {
      canonical,
    },
  };
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
      const r = await entriesClient
        .from("entries")
        .select("slug")
        .eq("id", id)
        .maybeSingle();
      if (!r.error && r.data) {
        const s = (r.data as { slug?: string | null }).slug;
        if (typeof s === "string" && s.trim().length > 0) {
          permanentRedirect(`/${s.trim()}`);
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
