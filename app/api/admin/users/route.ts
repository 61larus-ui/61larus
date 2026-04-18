import { NextResponse } from "next/server";

export const runtime = "nodejs";
import bcrypt from "bcryptjs";
import { requireAdminSession, requireSuperAdminSession } from "@/lib/admin-api-auth";
import {
  normalizeAdminUsername,
  type AdminRole,
} from "@/lib/admin-role";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

export async function GET() {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;
  const deny = requireSuperAdminSession(gate.session);
  if (deny) return deny;

  const service = createSupabaseServiceClient();
  if (!service) {
    return NextResponse.json(
      {
        error:
          "Yönetici listesi için SUPABASE_SERVICE_ROLE_KEY tanımlanmalıdır.",
      },
      { status: 503 }
    );
  }

  let { data, error } = await service
    .from("admin_users")
    .select("id, username, role, is_active, created_at")
    .order("created_at", { ascending: true });

  if (error?.code === "42703") {
    const r2 = await service
      .from("admin_users")
      .select("id, username, role, created_at")
      .order("created_at", { ascending: true });
    data =
      r2.data?.map((u) => ({
        ...u,
        is_active: true as boolean,
      })) ?? null;
    error = r2.error;
  }

  if (error) {
    return NextResponse.json(
      { error: error.message || "Liste alınamadı." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, users: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;
  const deny = requireSuperAdminSession(gate.session);
  if (deny) return deny;

  let body: {
    username?: string;
    password?: string;
    role?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const rawUser =
    typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const roleRaw = typeof body.role === "string" ? body.role.trim() : "";

  const username = normalizeAdminUsername(rawUser);
  if (username.length < 2 || username.length > 64) {
    return NextResponse.json(
      { error: "Kullanıcı adı 2–64 karakter arasında olmalıdır." },
      { status: 400 }
    );
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return NextResponse.json(
      {
        error:
          "Kullanıcı adı yalnızca küçük harf, rakam, nokta, tire ve alt çizgi içerebilir.",
      },
      { status: 400 }
    );
  }
  if (password.length < 10) {
    return NextResponse.json(
      { error: "Geçici şifre en az 10 karakter olmalıdır." },
      { status: 400 }
    );
  }

  let role: AdminRole;
  if (roleRaw === "super_admin" || roleRaw === "editor_admin") {
    role = roleRaw;
  } else {
    return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  if (!service) {
    return NextResponse.json(
      {
        error:
          "Yönetici oluşturmak için SUPABASE_SERVICE_ROLE_KEY tanımlanmalıdır.",
      },
      { status: 503 }
    );
  }

  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await service
    .from("admin_users")
    .insert({
      username,
      password_hash,
      role,
    })
    .select("id, username, role, created_at")
    .maybeSingle();

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return NextResponse.json(
        { error: "Bu kullanıcı adı zaten kayıtlı." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Yönetici oluşturulamadı." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    user: data
      ? { ...data, is_active: true as boolean }
      : data,
  });
}
