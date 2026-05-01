import { NextResponse } from "next/server";

export const runtime = "nodejs";
import { requireAdminSession, requireSuperAdminSession } from "@/lib/admin-api-auth";
import {
  isProtectedPrimarySuper,
  type AdminRole,
} from "@/lib/admin-role";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;
  const deny = requireSuperAdminSession(gate.session);
  if (deny) return deny;

  const { id } = await ctx.params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Geçersiz kayıt." }, { status: 400 });
  }

  let body: { is_active?: boolean; role?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY tanımlanmalıdır." },
      { status: 503 }
    );
  }

  const { data: row, error: fetchErr } = await service
    .from("admin_users")
    .select("id, username, role, is_active")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  if (isProtectedPrimarySuper(row.username)) {
    if (body.role !== undefined && body.role !== "super_admin") {
      return NextResponse.json(
        {
          error:
            "Ana yönetici hesabının rolü düşürülemez veya değiştirilemez.",
        },
        { status: 403 }
      );
    }
    if (body.is_active === false) {
      return NextResponse.json(
        {
          error: "Ana yönetici hesabı devre dışı bırakılamaz.",
        },
        { status: 403 }
      );
    }
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.is_active === "boolean") {
    patch.is_active = body.is_active;
  }
  if (typeof body.role === "string") {
    if (body.role !== "super_admin" && body.role !== "editor_admin") {
      return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
    }
    patch.role = body.role as AdminRole;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Güncellenecek alan yok." },
      { status: 400 }
    );
  }

  const { data: updated, error } = await service
    .from("admin_users")
    .update(patch)
    .eq("id", id)
    .select("id, username, role, is_active, created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Güncellenemedi." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, user: updated });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;
  const deny = requireSuperAdminSession(gate.session);
  if (deny) return deny;

  const { id } = await ctx.params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Geçersiz kayıt." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY tanımlanmalıdır." },
      { status: 503 }
    );
  }

  const { data: row } = await service
    .from("admin_users")
    .select("username")
    .eq("id", id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  if (isProtectedPrimarySuper(row.username)) {
    return NextResponse.json(
      { error: "Ana yönetici hesabı silinemez." },
      { status: 403 }
    );
  }

  const { error } = await service.from("admin_users").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: error.message || "Silinemedi." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
