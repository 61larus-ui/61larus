import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServiceClient } from "@/lib/supabase-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const MIN_CONTENT_LEN = 100;

type EntryRow = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  category: string | null;
  slug: string | null;
};

type RawPartial = {
  id: string;
  title: string | null;
  content: string | null;
  created_at: string;
  category?: string | null;
  slug?: string | null;
};

function passesFilters(row: {
  title: string | null;
  content: string | null;
}): boolean {
  const title = (row.title ?? "").trim();
  const content = (row.content ?? "").trim();
  if (!title || !content) return false;
  if (content.length < MIN_CONTENT_LEN) return false;
  return true;
}

function normalizeRow(r: RawPartial): EntryRow {
  return {
    id: r.id,
    title: (r.title ?? "").trim(),
    content: (r.content ?? "").trim(),
    created_at: r.created_at,
    category: r.category ?? null,
    slug:
      typeof r.slug === "string" && r.slug.trim() ? r.slug.trim() : null,
  };
}

export async function GET() {
  const client = createSupabaseServiceClient();
  if (!client) {
    return NextResponse.json({
      error: "Supabase yapılandırılmadı",
      entries: [],
    });
  }

  const db: SupabaseClient = client;

  async function fetchPaged(
    supabase: SupabaseClient,
    cols: string,
  ): Promise<{ data: RawPartial[] | null; error: string | null }> {
    const out: RawPartial[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("entries")
        .select(cols)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) return { data: null, error: error.message };
      const batch = (data ?? []) as unknown as RawPartial[];
      if (batch.length === 0) break;
      out.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
    return { data: out, error: null };
  }

  let { data, error } = await fetchPaged(
    db,
    "id, title, content, created_at, category, slug",
  );

  if (error && /slug|column|schema|not exist/i.test(error)) {
    const r2 = await fetchPaged(db, "id, title, content, created_at, category");
    if (r2.error) {
      return NextResponse.json({ error: r2.error, entries: [] }, { status: 500 });
    }
    data = r2.data!.map((r) => ({ ...r, slug: null }));
    error = null;
  } else if (error) {
    const r3 = await fetchPaged(db, "id, title, content, created_at");
    if (r3.error) {
      return NextResponse.json({ error: r3.error, entries: [] }, { status: 500 });
    }
    data = r3.data!.map((r) => ({
      ...r,
      category: null,
      slug: null,
    }));
    error = null;
  }

  if (error) {
    return NextResponse.json({ error, entries: [] }, { status: 500 });
  }

  const entries: EntryRow[] = [];
  for (const r of data ?? []) {
    if (!passesFilters(r)) continue;
    entries.push(normalizeRow(r));
  }

  return NextResponse.json({
    entries,
    count: entries.length,
  });
}
