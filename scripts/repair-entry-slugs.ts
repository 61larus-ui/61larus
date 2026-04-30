/**
 * Tüm `public.entries` slug’larını başlığa göre yeniden hesaplar; çakışmalarda -2, -3 … ekler.
 * Önce bellekte atama, sonra DB güncellemesi. `.env.local` gerekir.
 *
 *   npm run repair-slugs
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import {
  allocateUniqueSlug,
  entrySlugRootFromBase,
  normalizeEntrySlug,
  slugifyEntryTitle,
} from "../lib/slug";

dotenv.config({ path: ".env.local" });

type Row = {
  id: string;
  title: string | null;
  slug: string | null;
  created_at: string;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli (.env.local)."
    );
    process.exit(1);
  }

  const service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await service
    .from("entries")
    .select("id, title, slug, created_at")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("Liste alınamadı:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) {
    console.log(
      JSON.stringify(
        { repaired: 0, skipped: 0, duplicateFixed: 0, total: 0 },
        null,
        2
      )
    );
    return;
  }

  const taken = new Set<string>();
  const idToFinal = new Map<string, string>();
  let duplicateFixed = 0;

  for (const row of rows) {
    const title = (row.title ?? "").trim();
    const base =
      normalizeEntrySlug(title) || slugifyEntryTitle(row.title ?? "", row.id);
    const r = entrySlugRootFromBase(base);
    const final = allocateUniqueSlug(base, taken);
    if (final !== r) {
      duplicateFixed += 1;
    }
    idToFinal.set(row.id, final);
  }

  let repaired = 0;
  let skipped = 0;

  const toApply = rows.filter((row) => {
    const final = idToFinal.get(row.id)!;
    const cur =
      typeof row.slug === "string" && row.slug.trim().length > 0
        ? row.slug.trim()
        : "";
    return cur !== final;
  });

  for (const row of toApply) {
    const { error: upErr } = await service
      .from("entries")
      .update({ slug: `__repair_tmp_${row.id.replace(/-/g, "")}` })
      .eq("id", row.id);
    if (upErr) {
      console.error(
        "[repair-slugs] geçici slug hatası",
        row.id,
        upErr.message
      );
    }
  }

  for (const row of rows) {
    const final = idToFinal.get(row.id)!;
    const cur =
      typeof row.slug === "string" && row.slug.trim().length > 0
        ? row.slug.trim()
        : "";
    if (cur === final) {
      skipped += 1;
      continue;
    }
    const { error: upErr } = await service
      .from("entries")
      .update({ slug: final })
      .eq("id", row.id);
    if (upErr) {
      console.error("[repair-slugs] güncelleme hatası", row.id, upErr.message);
      continue;
    }
    repaired += 1;
    console.log("[repair-slugs] güncellendi", row.id, "->", final);
  }

  console.log(
    JSON.stringify(
      {
        repaired,
        skipped,
        duplicateFixed,
        total: rows.length,
      },
      null,
      2
    )
  );
}

void main();
