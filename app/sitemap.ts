import { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

const BASE_URL = "https://61sozluk.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const home: MetadataRoute.Sitemap[0] = {
    url: `${BASE_URL}/`,
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
          url: `${BASE_URL}/${encodeURI(slug)}`,
          lastModified: last,
          changeFrequency: "daily" as const,
          priority: 0.8,
        };
      }
    )
    .filter((row): row is NonNullable<typeof row> => row != null);

  const approvedEnRes = await client
    .from("entries")
    .select("slug, created_at, title_en, content_en")
    .eq("global_translation_status", "approved");

  const approvedEnUrls: MetadataRoute.Sitemap =
    !approvedEnRes.error && approvedEnRes.data?.length
      ? approvedEnRes.data
          .filter((row) => {
            const slug =
              typeof row.slug === "string" ? row.slug.trim() : "";
            const titleEn =
              typeof row.title_en === "string" ? row.title_en.trim() : "";
            const contentEn =
              typeof row.content_en === "string" ? row.content_en.trim() : "";
            return (
              slug.length > 0 && titleEn.length > 0 && contentEn.length > 0
            );
          })
          .map((entry) => {
            const slug = (entry.slug as string).trim();
            const last =
              entry.created_at != null &&
              String(entry.created_at).length > 0
                ? new Date(entry.created_at as string)
                : new Date();
            return {
              url: `${BASE_URL}/en/${encodeURI(slug)}`,
              lastModified: last,
              changeFrequency: "weekly" as const,
              priority: 0.7,
            };
          })
      : [];

  return [home, ...entryUrls, ...approvedEnUrls];
}
