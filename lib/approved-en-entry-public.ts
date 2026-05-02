import { unstable_noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function decodeSlugSegment(segment: string): string {
  const t = segment.trim();
  if (!t) return "";
  try {
    return decodeURIComponent(t).trim();
  } catch {
    return t;
  }
}

export type ApprovedEnglishEntryPublic = {
  id: string;
  slug: string;
  title_en: string;
  content_en: string;
  created_at: string;
};

/**
 * Onaylı İngilizce entry — yalnızca anon Supabase server client (service role yok).
 */
export async function loadApprovedEnglishEntryPublic(
  rawSegment: string
): Promise<ApprovedEnglishEntryPublic | null> {
  unstable_noStore();
  const segment = decodeSlugSegment(rawSegment);
  if (!segment) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("entries")
    .select(
      "id, slug, title_en, content_en, created_at, global_translation_status"
    )
    .eq("slug", segment)
    .eq("global_translation_status", "approved")
    .maybeSingle();

  if (error) {
    console.warn("[approved-en-entry]", error.message);
    return null;
  }
  if (!data) return null;

  const rowSlug = typeof data.slug === "string" ? data.slug.trim() : "";
  if (rowSlug !== segment) return null;

  const title_en =
    typeof data.title_en === "string" ? data.title_en.trim() : "";
  const content_en =
    typeof data.content_en === "string" ? data.content_en.trim() : "";
  if (!title_en || !content_en) return null;

  return {
    id: data.id as string,
    slug: rowSlug,
    title_en,
    content_en,
    created_at:
      typeof data.created_at === "string" && data.created_at.length > 0
        ? data.created_at
        : "",
  };
}
