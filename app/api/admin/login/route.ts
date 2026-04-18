import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
import { verifyAdminLogin } from "@/lib/admin-auth-verify";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieMaxAge,
  createAdminSessionToken,
} from "@/lib/admin-session";

export async function POST(req: Request) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      {
        error:
          "Sunucu yapılandırması eksik: en az 16 karakter ADMIN_SESSION_SECRET tanımlayın.",
      },
      { status: 500 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const username =
    typeof body.username === "string" ? body.username.trim() : "";
  const password =
    typeof body.password === "string" ? body.password.trim() : "";
  if (!username || !password) {
    return NextResponse.json(
      { error: "Kullanıcı adı ve şifre zorunludur." },
      { status: 400 }
    );
  }

  const auth = await verifyAdminLogin(username, password);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Kullanıcı adı veya şifre hatalı." },
      { status: 401 }
    );
  }

  const token = createAdminSessionToken(secret, {
    username: auth.username,
    role: auth.role,
  });
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: adminSessionCookieMaxAge(),
  });

  return NextResponse.json({
    ok: true,
    username: auth.username,
    role: auth.role,
  });
}
