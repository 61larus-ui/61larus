import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import {
  fetchAllEntryTitles,
  isTitleTooSimilarToAny,
} from "@/lib/entry-title-similarity";
import { validateTitleQuality } from "@/lib/entry-title-rules";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;

  let body: { title?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";

  if (!title) {
    return NextResponse.json({ error: "Başlık gerekli." }, { status: 400 });
  }

  const qualityError = validateTitleQuality(title);
  if (qualityError) {
    return NextResponse.json({ error: qualityError }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  if (!service) {
    return NextResponse.json(
      {
        error:
          "Başlık kontrolü için SUPABASE_SERVICE_ROLE_KEY tanımlanmalıdır.",
      },
      { status: 503 }
    );
  }

  let existingTitles: string[];
  try {
    existingTitles = await fetchAllEntryTitles(service);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Başlık benzerlik kontrolü başarısız.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const tooSimilar =
    title.length > 0 && isTitleTooSimilarToAny(title, existingTitles);

  return NextResponse.json({ tooSimilar });
}
