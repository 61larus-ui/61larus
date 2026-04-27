import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

export const runtime = "nodejs";

const MAX_Q_LEN = 200;
const MAX_RESULTS = 8;

/** ILIKE wildcards — user input should not control pattern shape. */
function sanitizeIlikeToken(w: string): string {
  return w.replace(/[%_\\]/g, "");
}

export type SearchEntryResult = {
  id: string;
  title: string;
  category: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qRaw = url.searchParams.get("q");
  const q =
    typeof qRaw === "string" ? qRaw.normalize("NFC").trim() : "";
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] as SearchEntryResult[] });
  }

  const capped = q.length > MAX_Q_LEN ? q.slice(0, MAX_Q_LEN) : q;
  const words = capped
    .split(/\s+/)
    .map(sanitizeIlikeToken)
    .filter((w) => w.length > 0);
  if (words.length === 0) {
    return NextResponse.json({ results: [] as SearchEntryResult[] });
  }

  const supabase = await createSupabaseServerClient();
  const client = createSupabaseServiceClient() ?? supabase;

  try {
    let query = client
      .from("entries")
      .select("id, title, category, created_at")
      .order("created_at", { ascending: false })
      .limit(MAX_RESULTS);

    for (const w of words) {
      query = query.ilike("title", `%${w}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[search-entries]", error);
      return NextResponse.json({ results: [] as SearchEntryResult[] });
    }

    const rows = data ?? [];
    const results: SearchEntryResult[] = rows.map(
      (r: {
        id: string;
        title: string | null;
        category: string | null;
        created_at: string;
      }) => ({
        id: r.id,
        title: typeof r.title === "string" ? r.title : "",
        category: r.category,
        created_at: r.created_at,
      })
    );
    return NextResponse.json({ results });
  } catch (e) {
    console.error("[search-entries]", e);
    return NextResponse.json({ results: [] as SearchEntryResult[] });
  }
}
