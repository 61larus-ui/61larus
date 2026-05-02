import { NextResponse } from "next/server";

export const runtime = "nodejs";

import { requireAdminSession, requireSuperAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

function normalizeWorkflowStatus(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

export async function POST(req: Request) {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;
  const deny = requireSuperAdminSession(gate.session);
  if (deny) return deny;

  let body: { entryId?: string };
  try {
    body = (await req.json()) as { entryId?: string };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const entryIdRaw = body.entryId;
  const entryId =
    typeof entryIdRaw === "string" ? entryIdRaw.trim() : "";
  if (!entryId) {
    return NextResponse.json({ error: "entryId gerekli." }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY tanımlanmalıdır." },
      { status: 503 }
    );
  }

  const cur = await supabase
    .from("entries")
    .select("id, global_translation_status, title_en, content_en")
    .eq("id", entryId)
    .maybeSingle();

  if (cur.error) {
    console.error("[global-translation/approve] read:", cur.error);
    return NextResponse.json(
      { error: cur.error.message || "Entry okunamadı." },
      { status: 500 }
    );
  }
  if (!cur.data) {
    return NextResponse.json({ error: "Entry bulunamadı." }, { status: 404 });
  }

  const row = cur.data as {
    id: string;
    global_translation_status: string | null;
    title_en: string | null;
    content_en: string | null;
  };

  if (normalizeWorkflowStatus(row.global_translation_status) !== "draft") {
    return NextResponse.json(
      {
        error:
          "Bu entry için İngilizce yayın onayı yalnızca taslak (draft) statüsündeki kayıtlar için geçerlidir.",
      },
      { status: 400 }
    );
  }

  const titleEn = typeof row.title_en === "string" ? row.title_en.trim() : "";
  const contentEn =
    typeof row.content_en === "string" ? row.content_en.trim() : "";

  if (!titleEn || !contentEn) {
    return NextResponse.json(
      { error: "title_en ve content_en dolu olmalıdır." },
      { status: 400 }
    );
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("entries")
    .update({
      global_translation_status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .select("id, slug, global_translation_status, updated_at");

  if (updateError) {
    console.error("[global-translation/approve] update error:", updateError);
    return NextResponse.json(
      { ok: false, error: "Update failed" },
      { status: 500 }
    );
  }

  if (!updatedRows || updatedRows.length !== 1) {
    console.error("[global-translation/approve] update row count mismatch:", {
      entryId,
      updatedRows,
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Entry update did not affect exactly one row",
      },
      { status: 500 }
    );
  }

  console.log("[global-translation/approve] success:", updatedRows[0]);

  return NextResponse.json({
    ok: true,
    status: "approved",
    entry: updatedRows[0],
  });
}
