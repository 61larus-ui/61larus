import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  parseAdminSessionPayload,
  verifyAdminSessionToken,
} from "@/lib/admin-session";
import type { AdminRole } from "@/lib/admin-role";

export async function getAdminSessionValid(): Promise<boolean> {
  const s = await getAdminSession();
  return s !== null;
}

export async function getAdminSession(): Promise<{
  username: string;
  role: AdminRole;
} | null> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) return null;
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [payload] = raw.split(".");
  if (!payload || !verifyAdminSessionToken(raw, secret)) return null;
  const parsed = parseAdminSessionPayload(payload);
  if (!parsed) return null;
  return { username: parsed.username, role: parsed.role };
}
