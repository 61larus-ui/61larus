import { NextResponse } from "next/server";

export const runtime = "nodejs";
import bcrypt from "bcryptjs";
import { verifyAdminUserPassword } from "@/lib/admin-auth-verify";
import { requireAdminSession, requireSuperAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

export async function POST(req: Request) {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;

  const deny = requireSuperAdminSession(gate.session);
  if (deny) return deny;

  let body: {
    currentPassword?: string;
    newPassword?: string;
    newPasswordAgain?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const current =
    typeof body.currentPassword === "string" ? body.currentPassword : "";
  const nextPass =
    typeof body.newPassword === "string" ? body.newPassword : "";
  const again =
    typeof body.newPasswordAgain === "string" ? body.newPasswordAgain : "";

  if (!current || !nextPass || !again) {
    return NextResponse.json(
      { error: "Tüm şifre alanları doldurulmalıdır." },
      { status: 400 }
    );
  }
  if (nextPass !== again) {
    return NextResponse.json(
      { error: "Yeni şifre ile tekrarı eşleşmiyor." },
      { status: 400 }
    );
  }
  if (nextPass.length < 10) {
    return NextResponse.json(
      { error: "Yeni şifre en az 10 karakter olmalıdır." },
      { status: 400 }
    );
  }

  if (!(await verifyAdminUserPassword(gate.session.username, current))) {
    return NextResponse.json(
      { error: "Mevcut şifre hatalı." },
      { status: 400 }
    );
  }

  const service = createSupabaseServiceClient();
  if (!service) {
    return NextResponse.json(
      {
        error:
          "Kalıcı şifre kaydı için SUPABASE_SERVICE_ROLE_KEY ortam değişkeni tanımlanmalıdır.",
      },
      { status: 503 }
    );
  }

  const u = gate.session.username;
  const password_hash = await bcrypt.hash(nextPass, 10);
  const { error } = await service
    .from("admin_users")
    .update({ password_hash })
    .eq("username", u);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Şifre güncellenemedi." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Şifre güncellendi. Bundan sonra giriş bu şifre ile yapılır.",
  });
}
