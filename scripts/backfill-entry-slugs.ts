/**
 * One-off: public.entries satırlarına slug doldurur (title + benzersizlik).
 * Canlı veritabanında dikkat: önce yedek al; DRY çalıştır (DRY_RUN=1).
 *
 * SQL (Supabase SQL editor — kolon yoksa):
 *   alter table public.entries add column if not exists slug text;
 *   create unique index if not exists entries_slug_key on public.entries (slug);
 *   -- NULL slug’lar tekil sayılır; boşluk bırakmayın, NULL bırakın
 *
 * Çalıştırma (yerel, .env.local gerekir):
 *   npx ts-node --compiler-options "{\\"module\\":\\"CommonJS\\"}" scripts/backfill-entry-slugs.ts
 * Kuru: DRY_RUN=1 npx ts-node ...
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { ensureUniqueEntrySlug, slugifyEntryTitle } from "../lib/entry-slug";

function loadLocalEnv() {
  const p = join(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadLocalEnv();

const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

async function main() {
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.");
    process.exit(1);
  }
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await service
    .from("entries")
    .select("id, title, slug");
  if (error) {
    console.error("Liste alınamadı:", error.message);
    process.exit(1);
  }
  const rows = (data ?? []) as { id: string; title: string; slug: string | null }[];
  const toFix = rows.filter(
    (r) => r.slug == null || String(r.slug).trim() === ""
  );
  console.log(
    `Toplam ${rows.length} entry; boş slug: ${toFix.length}; dryRun=${dryRun}`
  );
  for (const row of toFix) {
    const next = await ensureUniqueEntrySlug(
      service,
      slugifyEntryTitle(row.title ?? "", row.id),
      { excludeEntryId: row.id }
    );
    if (dryRun) {
      console.log(`[dry] ${row.id} -> ${next}`);
    } else {
      const { error: upErr } = await service
        .from("entries")
        .update({ slug: next })
        .eq("id", row.id);
      if (upErr) {
        console.error(`Güncelleme hatası ${row.id}:`, upErr.message);
      } else {
        console.log(`OK ${row.id} -> ${next}`);
      }
    }
  }
}

void main();
