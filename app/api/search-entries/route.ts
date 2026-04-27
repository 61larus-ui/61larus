import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

export const runtime = "nodejs";

const MAX_Q_LEN = 200;
const MAX_RESULTS = 8;
/** B sorgusunda, A ile çakışma sonrası 8 doldurabilmek için yeterli satır. */
const B_FETCH_CAP = 32;

/** ILIKE wildcards — user input should not control pattern shape. */
function sanitizeIlikeToken(w: string): string {
  return w.replace(/[%_\\]/g, "");
}

/** Tüm cümle için prefix pattern’i (boşluklar korunur, wildcard metinleri silinir). */
function prefixPatternFromCapped(capped: string): string {
  return capped.replace(/[%_\\]/g, "");
}

type EntryRow = {
  id: string;
  title: string | null;
  category: string | null;
  created_at: string;
};

function mapToResult(r: EntryRow) {
  return {
    id: r.id,
    title: typeof r.title === "string" ? r.title : "",
    category: r.category,
    created_at: r.created_at,
  };
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
    const prefixCapped = prefixPatternFromCapped(capped);
    const hasPrefix = prefixCapped.length > 0;

    function withWordIlikes(needLimit: number) {
      let qb = client
        .from("entries")
        .select("id, title, category, created_at")
        .order("created_at", { ascending: false })
        .limit(needLimit);
      for (const w of words) {
        qb = qb.ilike("title", `%${w}%`);
      }
      return qb;
    }

    const bLimit = hasPrefix ? B_FETCH_CAP : MAX_RESULTS;

    const [resA, resB] = await Promise.all([
      hasPrefix
        ? withWordIlikes(MAX_RESULTS).ilike("title", `${prefixCapped}%`)
        : Promise.resolve({ data: [] as EntryRow[], error: null }),
      withWordIlikes(bLimit),
    ]);

    if (resA.error) {
      console.error("[search-entries]", resA.error);
      return NextResponse.json({ results: [] as SearchEntryResult[] });
    }
    if (resB.error) {
      console.error("[search-entries]", resB.error);
      return NextResponse.json({ results: [] as SearchEntryResult[] });
    }

    const rowsA: EntryRow[] = (resA.data ?? []) as EntryRow[];
    const rowsB: EntryRow[] = (resB.data ?? []) as EntryRow[];
    const aIds = new Set(rowsA.map((r) => r.id));
    const merged: EntryRow[] = [];
    for (const r of rowsA) {
      if (merged.length >= MAX_RESULTS) break;
      merged.push(r);
    }
    for (const r of rowsB) {
      if (merged.length >= MAX_RESULTS) break;
      if (aIds.has(r.id)) continue;
      merged.push(r);
    }
    const results: SearchEntryResult[] = merged.map((r) => mapToResult(r));
    return NextResponse.json({ results });
  } catch (e) {
    console.error("[search-entries]", e);
    return NextResponse.json({ results: [] as SearchEntryResult[] });
  }
}
