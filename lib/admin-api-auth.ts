import { NextResponse } from "next/server";
import { isSuperAdminRole, type AdminRole } from "@/lib/admin-role";
import { getAdminSession } from "@/lib/admin-session-cookies";

export type AdminSessionContext = { username: string; role: AdminRole };

export async function requireAdminSession(): Promise<
  | { ok: true; session: AdminSessionContext }
  | { ok: false; response: NextResponse }
> {
  const session = await getAdminSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Oturum gerekli." }, { status: 401 }),
    };
  }
  return { ok: true, session };
}

export function requireSuperAdminSession(
  session: AdminSessionContext,
  message = "Bu işlem yalnızca tam yetkili yöneticiler içindir."
): NextResponse | null {
  if (!isSuperAdminRole(session.role)) {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  return null;
}
