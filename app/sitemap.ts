import { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

const BASE = "https://61larus.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const home: MetadataRoute.Sitemap[0] = {
    url: BASE,
    lastModified: new Date(),
  };

  const supabase = await createSupabaseServerClient();
  const client = createSupabaseServiceClient() ?? supabase;
  const { data, error } = await client
    .from("entries")
    .select("id, created_at")
    .order("created_at", { ascending: false });

  if (error || !data?.length) {
    return [home];
  }

  const entryUrls: MetadataRoute.Sitemap = data.map(
    (entry: { id: string; created_at: string | null }) => {
      const last =
        entry.created_at != null && entry.created_at.length > 0
          ? new Date(entry.created_at)
          : new Date();
      return {
        url: `${BASE}/?entry=${entry.id}`,
        lastModified: last,
      };
    }
  );

  return [home, ...entryUrls];
}
