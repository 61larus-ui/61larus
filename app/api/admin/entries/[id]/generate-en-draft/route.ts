import { NextResponse } from "next/server";

export const runtime = "nodejs";

import { requireAdminSession, requireSuperAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { generateGlobalEnglishDraft } from "@/lib/global-en-draft-generation";

type Ctx = { params: Promise<{ id: string }> };

function normalizeWorkflowStatus(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

export async function POST(_req: Request, ctx: Ctx) {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;
  const deny = requireSuperAdminSession(gate.session);
  if (deny) return deny;

  const { id } = await ctx.params;
  if (!id || id.trim().length === 0) {
    return NextResponse.json({ error: "Geçersiz entry." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY tanımlanmalıdır." },
      { status: 503 }
    );
  }

  const cur = await service
    .from("entries")
    .select(
      "id, title, content, global_translation_status, title_en, content_en"
    )
    .eq("id", id)
    .maybeSingle();

  if (cur.error) {
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
    title: string | null;
    content: string | null;
    global_translation_status: string | null;
    title_en: string | null;
    content_en: string | null;
  };

  const st = normalizeWorkflowStatus(row.global_translation_status);
  if (st !== "candidate") {
    return NextResponse.json(
      {
        error:
          "İngilizce taslak yalnızca global_translation_status = candidate olan kayıtlar için oluşturulabilir.",
      },
      { status: 400 }
    );
  }

  const existingTitleEn =
    typeof row.title_en === "string" ? row.title_en.trim() : "";
  if (existingTitleEn.length > 0) {
    return NextResponse.json(
      {
        error:
          "Bu entry için title_en zaten dolu; taslak yeniden üretilmez.",
      },
      { status: 409 }
    );
  }

  const trTitle = typeof row.title === "string" ? row.title.trim() : "";
  const trContent = typeof row.content === "string" ? row.content.trim() : "";
  if (!trTitle || !trContent) {
    return NextResponse.json(
      { error: "Entry başlık veya içerik eksik." },
      { status: 400 }
    );
  }

  let draft: { title_en: string; content_en: string };
  try {
    draft = await generateGlobalEnglishDraft({
      trTitle,
      trContent,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Taslak üretilemedi.";
    const lower = msg.toLowerCase();
    const status =
      lower.includes("openai_api_key") || lower.includes("not configured")
        ? 503
        : 502;
    return NextResponse.json({ error: msg }, { status });
  }

  const upd = await service
    .from("entries")
    .update({
      title_en: draft.title_en,
      content_en: draft.content_en,
      global_translation_status: "draft",
    })
    .eq("id", id);

  if (upd.error) {
    return NextResponse.json(
      { error: upd.error.message || "Kaydedilemedi." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    title_en: draft.title_en,
    content_en: draft.content_en,
    global_translation_status: "draft",
  });
}
