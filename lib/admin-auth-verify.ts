import bcrypt from "bcryptjs";
import {
  normalizeAdminUsername,
  SUPER_ADMIN_USERNAME,
  type AdminRole,
} from "@/lib/admin-role";
import { hashAdminPassword, verifyAdminPasswordScrypt } from "@/lib/admin-password";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

export type AdminLoginResult =
  | { ok: false }
  | { ok: true; username: string; role: AdminRole };

type TryLoginRpcResult =
  | { ok: true; role: string }
  | { ok: false }
  | null;

function parseAdminTryLoginRpc(data: unknown): TryLoginRpcResult {
  let o: Record<string, unknown> | null = null;
  if (typeof data === "string") {
    try {
      const parsed: unknown = JSON.parse(data);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        o = parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  } else if (data && typeof data === "object" && !Array.isArray(data)) {
    o = data as Record<string, unknown>;
  }
  if (!o) return null;

  const okRaw = o.ok;
  const okTrue = okRaw === true || okRaw === "true";
  const okFalse = okRaw === false || okRaw === "false";
  if (!okTrue && !okFalse) return null;
  if (okFalse) return { ok: false };
  if (typeof o.role !== "string") return null;
  const role = o.role.trim();
  if (!role) return null;
  return { ok: true, role };
}

type AdminLoginUserRow = {
  username: string;
  password_hash: string;
  role: string;
  password_salt?: string | null;
  is_active?: boolean | null;
};

async function fetchAdminUserRowForLogin(
  service: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  username: string
): Promise<{ data: AdminLoginUserRow | null; error: { code?: string; message: string } | null }> {
  const full = await service
    .from("admin_users")
    .select("username, password_hash, password_salt, role, is_active")
    .eq("username", username)
    .maybeSingle();

  if (!full.error && full.data) {
    return { data: full.data as AdminLoginUserRow, error: null };
  }

  if (full.error?.code === "42703") {
    const minimal = await service
      .from("admin_users")
      .select("username, password_hash, role")
      .eq("username", username)
      .maybeSingle();
    return {
      data: minimal.data as AdminLoginUserRow | null,
      error: minimal.error,
    };
  }

  return { data: null, error: full.error };
}

async function passwordMatchesDbCrypt(
  service: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  username: string,
  plain: string
): Promise<boolean> {
  const { data, error } = await service.rpc("admin_verify_password_crypt", {
    p_username: username,
    p_plain: plain,
  });
  if (error) return false;
  return data === true;
}

/**
 * Matches DB semantics for common Supabase/pgcrypto hashes:
 * - blowfish/bcrypt: password_hash = crypt(plain, password_hash) → verify with bcrypt.compare
 * - app scrypt rows: hex hash + hex salt
 */
async function matchesStoredPassword(
  plainTrimmed: string,
  passwordHash: string,
  passwordSalt: string
): Promise<boolean> {
  const hash = passwordHash;
  const salt = passwordSalt ?? "";

  if (hash.startsWith("$2")) {
    return bcrypt.compare(plainTrimmed, hash);
  }

  const looksLikeAppScrypt =
    salt.length > 0 &&
    hash.length > 0 &&
    /^[0-9a-f]+$/i.test(hash) &&
    /^[0-9a-f]+$/i.test(salt);

  if (looksLikeAppScrypt) {
    return verifyAdminPasswordScrypt(plainTrimmed, hash, salt);
  }

  return false;
}

export async function ensureAdminUserInDatabase(
  username: string,
  plainPassword: string,
  role: AdminRole
): Promise<void> {
  const service = createSupabaseServiceClient();
  if (!service) return;
  const u = normalizeAdminUsername(username);
  const { data: existing } = await service
    .from("admin_users")
    .select("id")
    .eq("username", u)
    .maybeSingle();
  if (existing) return;
  const { hash, salt } = await hashAdminPassword(plainPassword);
  const { error } = await service.from("admin_users").insert({
    username: u,
    password_hash: hash,
    password_salt: salt,
    role,
    is_active: true,
  });
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw new Error(error.message);
  }
}

export async function verifyAdminUserPassword(
  username: string,
  password: string
): Promise<boolean> {
  const u = normalizeAdminUsername(username);
  const plain = password.trim();
  if (!u || !plain) return false;

  const service = createSupabaseServiceClient();
  if (!service) return false;

  const { data: rpcRaw, error: rpcError } = await service.rpc(
    "admin_try_login",
    { p_username: u, p_plain: plain }
  );

  if (!rpcError) {
    const parsed = parseAdminTryLoginRpc(rpcRaw);
    if (parsed?.ok === false) return false;
    if (parsed?.ok === true) return true;
  }

  const { data: row } = await fetchAdminUserRowForLogin(service, u);

  if (!row) return false;

  if ("is_active" in row && row.is_active === false) return false;

  if (typeof row.password_hash !== "string") return false;
  const salt =
    typeof row.password_salt === "string" ? row.password_salt : "";

  return (
    (await matchesStoredPassword(plain, row.password_hash, salt)) ||
    (await passwordMatchesDbCrypt(service, u, plain))
  );
}

export async function verifyAdminLogin(
  username: string,
  password: string
): Promise<AdminLoginResult> {
  const u = normalizeAdminUsername(username);
  const plain = password.trim();
  if (!u || !plain) return { ok: false };

  const service = createSupabaseServiceClient();
  if (!service) return { ok: false };

  const { data: rpcRaw, error: rpcError } = await service.rpc(
    "admin_try_login",
    { p_username: u, p_plain: plain }
  );

  if (!rpcError) {
    const parsed = parseAdminTryLoginRpc(rpcRaw);
    if (parsed?.ok === false) {
      return { ok: false };
    }
    if (parsed?.ok === true) {
      const role = parsed.role as AdminRole;
      if (role !== "super_admin" && role !== "editor_admin") {
        return { ok: false };
      }
      const effectiveRole: AdminRole =
        u === SUPER_ADMIN_USERNAME ? "super_admin" : role;
      return {
        ok: true,
        username: u,
        role: effectiveRole,
      };
    }
  }

  const { data: row } = await fetchAdminUserRowForLogin(service, u);

  if (!row) return { ok: false };

  if ("is_active" in row && row.is_active === false) return { ok: false };

  const role = (typeof row.role === "string" ? row.role.trim() : row.role) as AdminRole;
  if (role !== "super_admin" && role !== "editor_admin") {
    return { ok: false };
  }

  if (typeof row.password_hash !== "string") return { ok: false };
  const salt =
    typeof row.password_salt === "string" ? row.password_salt : "";

  const passwordOk =
    (await matchesStoredPassword(plain, row.password_hash, salt)) ||
    (await passwordMatchesDbCrypt(service, u, plain));
  if (!passwordOk) return { ok: false };

  const effectiveRole: AdminRole =
    u === SUPER_ADMIN_USERNAME ? "super_admin" : role;

  return {
    ok: true,
    username: u,
    role: effectiveRole,
  };
}
