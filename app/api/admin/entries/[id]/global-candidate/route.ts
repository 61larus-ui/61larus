import { NextResponse } from "next/server";

export const runtime = "nodejs";

import { requireAdminSession, requireSuperAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { evaluateGlobalEntryCandidate } from "@/lib/global-entry-candidate";

type Ctx = { params: Promise<{ id: string }> };

function normalizeWorkflowStatus(raw: unknown): string {
  if (typeof raw !== "string") return "none";
  const t = raw.trim().toLowerCase();
  return t.length === 0 ? "none" : t;
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
    .select("id, title, content, global_translation_status")
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
  };

  const statusNorm = normalizeWorkflowStatus(row.global_translation_status);
  if (statusNorm !== "none") {
    return NextResponse.json(
      { error: "Bu entry zaten globale işaretlenmiş durumda." },
      { status: 409 }
    );
  }

  const assessment = evaluateGlobalEntryCandidate({
    title: typeof row.title === "string" ? row.title : "",
    content: typeof row.content === "string" ? row.content : "",
  });
  if (assessment.level !== "strong") {
    return NextResponse.json(
      { error: "Yalnızca güçlü global adaylar işaretlenebilir." },
      { status: 400 }
    );
  }

  const upd = await service
    .from("entries")
    .update({ global_translation_status: "candidate" })
    .eq("id", id);

  if (upd.error) {
    return NextResponse.json(
      { error: upd.error.message || "Güncellenemedi." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
