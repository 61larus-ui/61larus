import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { normalizeEntrySlug } from "../lib/slug";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function slugifyEntryTitle(title: string, idForFallback: string): string {
  const s = normalizeEntrySlug(title);
  if (s.length > 0) return s;
  const compact = idForFallback.replace(/-/g, "").slice(0, 8).toLowerCase();
  if (/^[0-9a-f]+$/i.test(compact) && compact.length > 0) {
    return compact;
  }
  return "entry";
}

async function ensureUniqueEntrySlug(
  service: SupabaseClient,
  baseSlug: string,
  options: { excludeEntryId?: string } = {}
): Promise<string> {
  const { excludeEntryId } = options;
  const root = (baseSlug || "entry").replace(/^-+|-+$/g, "") || "entry";
  let n = 0;
  for (;;) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    let q = service.from("entries").select("id").eq("slug", candidate).limit(1);
    if (excludeEntryId) {
      q = q.neq("id", excludeEntryId);
    }
    const { data, error } = await q;
    if (error && /column|schema|not exist|slug/i.test(error.message ?? "")) {
      return candidate;
    }
    if (error) {
      throw error;
    }
    if (!data?.length) {
      return candidate;
    }
    n += 1;
    if (n > 2000) {
      throw new Error("slug_serialization_exhausted");
    }
  }
}

async function run() {
  const { data: entries, error: fetchError } = await supabase
    .from("entries")
    .select("id,title,slug");

  if (fetchError) {
    console.error("fetch error:", fetchError.message);
    return;
  }

  if (!entries?.length) {
    console.log("entries yok");
    return;
  }

  let updatedCount = 0;

  for (const entry of entries) {
    const root =
      normalizeEntrySlug((entry.title ?? "").trim()) ||
      slugifyEntryTitle(entry.title ?? "", entry.id);
    const newSlug = await ensureUniqueEntrySlug(supabase, root, {
      excludeEntryId: entry.id,
    });

    if (entry.slug === newSlug) continue;

    const { error: updateError } = await supabase
      .from("entries")
      .update({ slug: newSlug })
      .eq("id", entry.id);

    if (updateError) {
      console.error("update failed", entry.id, updateError.message);
      continue;
    }

    updatedCount += 1;
    console.log("updated:", newSlug);
  }

  console.log("DONE", `(güncellenen: ${updatedCount})`);
}

run();
