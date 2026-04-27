import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function maskServiceKey(key: string): string {
  if (key.length <= 18) return `${key.slice(0, 4)}…len=${key.length}`;
  return `${key.slice(0, 12)}…${key.slice(-6)}`;
}

function jwtRoleClaimPeek(key: string): string | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    ) as { role?: unknown };
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}

function resolveSupabaseUrl(): string | undefined {
  const fromServer = process.env.SUPABASE_URL?.trim();
  if (fromServer) return fromServer;
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
}

/** Service role client for server-only admin operations. Optional at runtime. */
export function createSupabaseServiceClient(): SupabaseClient | null {
  const url = resolveSupabaseUrl();
  const rawService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rawAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const servicePresent = Boolean(rawService?.trim());
  const anonPresent = Boolean(rawAnon?.trim());
  const key = rawService?.trim();

  console.error("[supabase-service] env flags", {
    SUPABASE_URL_present: Boolean(process.env.SUPABASE_URL?.trim()),
    NEXT_PUBLIC_SUPABASE_URL_present: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    ),
    SUPABASE_SERVICE_ROLE_KEY_present: servicePresent,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_present: anonPresent,
    createClient_second_arg_from: "SUPABASE_SERVICE_ROLE_KEY",
    createClient_does_not_use: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  });

  if (!url || !key) {
    console.error("[supabase-service] abort createClient (missing url or service key)");
    return null;
  }

  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    /* keep raw */
  }
  const jwtRole = jwtRoleClaimPeek(key);
  console.error("[supabase-service] createClient", {
    urlHost: host,
    serviceKeyMaskedPrefixSuffix: maskServiceKey(key),
    keyLooksLikeJwt: key.split(".").length === 3,
    jwtPayloadRoleClaim: jwtRole,
  });

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
}
