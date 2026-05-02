import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const slug = "trabzon-sadece-futbol-ile-yasar-mit-mi-gercek-mi";

async function run() {
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const service = createClient(serviceUrl, serviceKey);

  const {
    data: svcData,
    error: svcErr,
  } = await service
    .from("entries")
    .select("id, slug, global_translation_status, title_en, content_en")
    .eq("slug", slug)
    .maybeSingle();

  console.log("SERVICE_RESULT:", svcData);
  console.log("SERVICE_ERROR:", svcErr);

  const anon = createClient(serviceUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  /** loadApprovedEnglishEntryPublic ile aynı filtre */
  const { data: anonData, error: anonErr } = await anon
    .from("entries")
    .select(
      "id, slug, title_en, content_en, created_at, global_translation_status"
    )
    .eq("slug", slug)
    .eq("global_translation_status", "approved")
    .maybeSingle();

  console.log("ANON_RESULT:", anonData);
  console.log("ANON_ERROR:", anonErr);
}

void run();
