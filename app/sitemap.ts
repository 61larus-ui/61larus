import { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { SITE_ORIGIN } from "@/lib/public-site-entry-url";

export const dynamic = "force-dynamic";

const BASE = SITE_ORIGIN;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const home: MetadataRoute.Sitemap[0] = {
    url: BASE,
    lastModified: new Date(),
    changeFrequency: "hourly",
    priority: 1,
  };

  const supabase = await createSupabaseServerClient();
  const client = createSupabaseServiceClient() ?? supabase;
  const withSlug = await client
    .from("entries")
    .select("id, created_at, slug")
    .order("created_at", { ascending: false });
  const res =
    withSlug.error &&
    /slug|column|schema|not exist/i.test(withSlug.error.message ?? "")
      ? await client
          .from("entries")
          .select("id, created_at")
          .order("created_at", { ascending: false })
      : withSlug;
  const { data, error } = res;

  if (error || !data?.length) {
    return [home];
  }

  const entryUrls: MetadataRoute.Sitemap = data
    .map(
      (entry: { id: string; created_at: string | null; slug?: string | null }) => {
        const last =
          entry.created_at != null && entry.created_at.length > 0
            ? new Date(entry.created_at)
            : new Date();
        const slug =
          typeof entry.slug === "string" && entry.slug.trim().length > 0
            ? entry.slug.trim()
            : null;
        if (!slug) return null;
        return {
          url: `${BASE}/${encodeURI(slug)}`,
          lastModified: last,
          changeFrequency: "daily" as const,
          priority: 0.8,
        };
      }
    )
    .filter(
      (row): row is NonNullable<typeof row> => row != null
    );

  return [home, ...entryUrls];
}
