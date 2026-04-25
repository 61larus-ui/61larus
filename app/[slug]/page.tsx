import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import HomePageClient from "../home-page-client";
import { EntryArticleJsonLd } from "@/components/entry-article-json-ld";
import { buildEntrySeoMetadata, SITE_BRAND } from "@/lib/entry-seo-metadata";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { getHomeClientProps } from "@/lib/home-client-props";

export const dynamic = "force-dynamic";

const SITE = "https://61larus.com";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug: raw } = await params;
  const segment = decodeURIComponent(raw).trim();
  if (!segment) {
    return { robots: { index: false, follow: true } };
  }

  const supabase = await createSupabaseServerClient();
  const client = createSupabaseServiceClient() ?? supabase;
  const { data, error } = await client
    .from("entries")
    .select("id, title, content, slug")
    .eq("slug", segment)
    .maybeSingle();

  if (error || !data) {
    return { robots: { index: false, follow: true } };
  }

  const titleRaw = typeof data.title === "string" ? data.title : "";
  const contentRaw = typeof data.content === "string" ? data.content : "";
  const entryTitle = titleRaw.trim();
  const pageTitle =
    entryTitle.length > 0 ? `${entryTitle} | ${SITE_BRAND}` : SITE_BRAND;
  const canonicalSlug =
    typeof (data as { slug?: string | null }).slug === "string" &&
    (data as { slug: string }).slug.trim().length > 0
      ? (data as { slug: string }).slug.trim()
      : segment;
  const canonical = `${SITE}/${canonicalSlug}`;

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

  const supabase = await createSupabaseServerClient();
  const client = createSupabaseServiceClient() ?? supabase;
  const { data: entry, error } = await client
    .from("entries")
    .select("id, slug, title, content, created_at")
    .eq("slug", segment)
    .maybeSingle();

  if (error || !entry) {
    notFound();
  }

  const row = entry as {
    id: string;
    title: string | null;
    content: string | null;
    created_at: string | null;
    slug?: string | null;
  };
  const id = row.id;
  if (
    typeof row.slug === "string" &&
    row.slug.trim() &&
    row.slug.trim() !== segment
  ) {
    permanentRedirect(`/${row.slug.trim()}`);
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
    <>
      <EntryArticleJsonLd
        title={row.title}
        content={row.content}
        createdAt={
          row.created_at != null ? String(row.created_at) : null
        }
      />
      <Suspense fallback={null}>
        <HomePageClient
          {...result.props}
          initialOpenEntryIdFromPath={id}
          pathCanonicalSlug={segment}
        />
      </Suspense>
    </>
  );
}
