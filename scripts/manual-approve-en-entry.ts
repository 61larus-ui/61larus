import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const slug = "trabzon-sadece-futbol-ile-yasar-mit-mi-gercek-mi";

async function run() {
  const { data, error } = await supabase
    .from("entries")
    .update({
      global_translation_status: "approved",
    })
    .eq("slug", slug)
    .select("id, slug, global_translation_status, title_en, content_en")
    .single();

  console.log("UPDATED:", data);
  console.log("ERROR:", error);
}

run();
