import { createHmac, timingSafeEqual } from "node:crypto";
import type { AdminRole } from "@/lib/admin-role";

export const ADMIN_SESSION_COOKIE = "admin_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

export type AdminSessionTokenPayloadV2 = {
  v: 2;
  exp: number;
  username: string;
  role: AdminRole;
};

export function createAdminSessionToken(
  secret: string,
  identity: { username: string; role: AdminRole }
): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = Buffer.from(
    JSON.stringify({
      v: 2,
      exp,
      username: identity.username,
      role: identity.role,
    } satisfies AdminSessionTokenPayloadV2),
    "utf8"
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAdminSessionToken(token: string, secret: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  if (!payload || !sig) return false;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  if (expected.length !== sig.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(sig, "utf8")
    );
  } catch {
    return false;
  }
}

export function parseAdminSessionPayload(
  payloadB64: string
): AdminSessionTokenPayloadV2 | null {
  try {
    const json = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as Partial<AdminSessionTokenPayloadV2>;
    if (json.v !== 2) return null;
    if (typeof json.exp !== "number") return null;
    if (json.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof json.username !== "string" || json.username.length === 0) {
      return null;
    }
    if (json.role !== "super_admin" && json.role !== "editor_admin") {
      return null;
    }
    return {
      v: 2,
      exp: json.exp,
      username: json.username,
      role: json.role,
    };
  } catch {
    return null;
  }
}

export function adminSessionCookieMaxAge(): number {
  return MAX_AGE_SEC;
}
