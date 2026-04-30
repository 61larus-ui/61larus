import { NextResponse } from "next/server";

export const runtime = "nodejs";
import { requireAdminSession, requireSuperAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { normalizeAdminEntryPublishSection } from "@/lib/admin-entry-publish-section";
import { ensureUniqueEntrySlug, slugifyEntryTitle } from "@/lib/entry-slug";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;
  const deny = requireSuperAdminSession(gate.session);
  if (deny) return deny;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Geçersiz entry." }, { status: 400 });
  }

  let body: { title?: string; content?: string; category?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const categoryRaw = body.category;
  const categoryTrim =
    typeof categoryRaw === "string" && categoryRaw.trim().length > 0
      ? categoryRaw.trim()
      : null;
  const category = normalizeAdminEntryPublishSection(categoryTrim);

  if (!title || !content) {
    return NextResponse.json(
      { error: "Başlık ve içerik zorunludur." },
      { status: 400 }
    );
  }

  if (!category) {
    return NextResponse.json(
      {
        error:
          "Yayın alanı zorunludur. Geçerli bir değer seçin (pending, trending, …).",
      },
      { status: 400 }
    );
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
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  const slugColumnMissing =
    cur.error && /slug|column|schema|not exist/i.test(cur.error.message ?? "");

  let nextSlug: string | null = null;
  if (!slugColumnMissing) {
    nextSlug = await ensureUniqueEntrySlug(service, slugifyEntryTitle(title, id), {
      excludeEntryId: id,
    });
  }

  const basePatch: {
    title: string;
    content: string;
    category: string;
    slug?: string;
  } = {
    title,
    content,
    category,
  };
  if (nextSlug !== null) {
    basePatch.slug = nextSlug;
  }

  let upd = await service.from("entries").update(basePatch).eq("id", id);

  if (upd.error && /slug|column|schema|not exist/i.test(upd.error.message)) {
    const { slug: _omit, ...noSlug } = basePatch;
    void _omit;
    upd = await service.from("entries").update(noSlug).eq("id", id);
  }

  if (upd.error && /category/i.test(upd.error.message)) {
    upd = await service
      .from("entries")
      .update(
        nextSlug !== null
          ? { title, content, slug: nextSlug }
          : { title, content }
      )
      .eq("id", id);
  }
  if (upd.error && /slug|column|schema|not exist/i.test(upd.error.message)) {
    upd = await service
      .from("entries")
      .update({ title, content })
      .eq("id", id);
  }

  if (upd.error) {
    return NextResponse.json(
      { error: upd.error.message || "Güncellenemedi." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;
  const deny = requireSuperAdminSession(gate.session);
  if (deny) return deny;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Geçersiz entry." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY tanımlanmalıdır." },
      { status: 503 }
    );
  }

  const { error } = await service.from("entries").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Silinemedi." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
