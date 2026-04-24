import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import {
  requireAdminSession,
  requireSuperAdminSession,
} from "@/lib/admin-api-auth";
import {
  ADMIN_FRIENDLY_ACTION_ERROR,
  ADMIN_SERVICE_KEY_MISSING_MESSAGE,
  ADMIN_USERS_WRITE_FORBIDDEN_MESSAGE,
  isMissingColumnError,
  isPermissionDeniedError,
} from "@/lib/admin-friendly-error";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { SILINMIS_KULLANICI_LABEL } from "@/lib/deleted-user-label";

type Ctx = { params: Promise<{ id: string }> };

type MemberAction = "suspend" | "reactivate" | "anonymize";

type PgishError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function parseAction(raw: unknown): MemberAction | null {
  if (raw === "suspend" || raw === "reactivate" || raw === "anonymize") {
    return raw;
  }
  return null;
}

function parseReason(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const r = (body as { reason?: unknown }).reason;
  if (typeof r !== "string") return null;
  const t = r.trim();
  if (t.length === 0) return null;
  return t.length > 2000 ? t.slice(0, 2000) : t;
}

function logAdminMemberError(
  operation: string,
  targetUserId: string,
  err: PgishError | null
): void {
  console.error("[admin/members PATCH]", {
    operation,
    targetUserId,
    code: err?.code ?? null,
    message: err?.message ?? null,
    details: err?.details ?? null,
    hint: err?.hint ?? null,
  });
}

function trimTargetUserId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/** Doğrulama satırında bayrak + tarih birlikte değerlendirilir. */
function rowLooksSuspended(row: {
  is_platform_access_suspended?: unknown;
  platform_access_suspended_at?: string | null;
}): boolean {
  const v = row.is_platform_access_suspended;
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "t" || s === "1") return true;
    if (s === "false" || s === "f" || s === "0") return false;
  }
  if (typeof v === "number" && !Number.isNaN(v)) return v === 1;
  return !!row.platform_access_suspended_at;
}

function publicErrorForDbError(
  err: PgishError,
  _operation: string
): { text: string; status: number } {
  if (isPermissionDeniedError(err)) {
    return { text: ADMIN_USERS_WRITE_FORBIDDEN_MESSAGE, status: 503 };
  }
  if (isMissingColumnError(err)) {
    return {
      text: "Veritabanı sütunları uygulama sürümüyle uyumsuz. Migrasyonları uygulayıp tekrar deneyin.",
      status: 503,
    };
  }
  return { text: ADMIN_FRIENDLY_ACTION_ERROR, status: 500 };
}

type ServiceClient = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;

/** Yalnızca `public.users` (PostgREST: `schema("public")` + `from("users")`). auth.users yok. */
function publicUsersFrom(service: ServiceClient) {
  return service.schema("public").from("users");
}

export async function PATCH(req: Request, ctx: Ctx) {
  let targetUserId = "";
  try {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;
  const deny = requireSuperAdminSession(gate.session);
  if (deny) return deny;

  const { id: rawId } = await ctx.params;
  const id = trimTargetUserId(rawId);
  targetUserId = id ?? "";
  if (!id) {
    return NextResponse.json({ error: "Geçersiz kayıt." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  const action = parseAction(
    typeof body === "object" && body !== null && "action" in body
      ? (body as { action?: unknown }).action
      : undefined
  );
  if (!action) {
    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  }

  /** RLS’i aşar: `lib/supabase-service` yalnızca `SUPABASE_SERVICE_ROLE_KEY` ile client oluşturur (anon değil). */
  const service = createSupabaseServiceClient();
  if (!service) {
    console.error(
      "[admin/members PATCH]",
      { operation: action, targetUserId: id },
      "no service client: SUPABASE_SERVICE_ROLE_KEY or URL missing"
    );
    return NextResponse.json(
      { error: ADMIN_SERVICE_KEY_MISSING_MESSAGE },
      { status: 503 }
    );
  }

  const now = new Date().toISOString();
  const reason = parseReason(body);

  if (action === "suspend") {
    console.error("[admin/members PATCH]", {
      phase: "suspend_request",
      targetUserId: id,
      hasReason: reason != null,
      reasonLength: reason?.length ?? 0,
    });

    const selectAfterSuspend =
      "id, is_platform_access_suspended, platform_access_suspended_at, platform_access_suspended_reason, updated_at";

    const result = await publicUsersFrom(service)
      .update({
        is_platform_access_suspended: true,
        platform_access_suspended_at: now,
        platform_access_suspended_reason: reason,
        updated_at: now,
      })
      .eq("id", id)
      .select(selectAfterSuspend);

    console.log("SUSPEND DEBUG RESULT", {
      targetUserId: id,
      table: "public.users",
      clientType:
        "server/service_role (createSupabaseServiceClient + SUPABASE_SERVICE_ROLE_KEY; not anon/session)",
      data: result.data,
      error: result.error,
      status: result.status,
    });
    console.log("SUSPEND DEBUG auth path", {
      authAdminApiUsed: false,
      authUsersUpdateUsed: false,
      note: "suspend PATCH yalnızca PostgREST public.users günceller; auth.users / Admin API yok.",
    });

    const suspendRow = Array.isArray(result.data) ? result.data[0] ?? null : null;

    if (result.error && isMissingColumnError(result.error)) {
      const suspendFb = await publicUsersFrom(service)
        .update({
          platform_access_suspended_at: now,
          updated_at: now,
        })
        .eq("id", id)
        .select(selectAfterSuspend);
      console.log("SUSPEND DEBUG RESULT (fallback)", {
        targetUserId: id,
        table: "public.users",
        clientType:
          "server/service_role (createSupabaseServiceClient + SUPABASE_SERVICE_ROLE_KEY; not anon/session)",
        data: suspendFb.data,
        error: suspendFb.error,
        status: suspendFb.status,
      });
      if (suspendFb.error) {
        logAdminMemberError("suspend_update_fallback", id, suspendFb.error);
        const mapped = publicErrorForDbError(
          suspendFb.error as PgishError,
          "suspend"
        );
        return NextResponse.json(
          { error: mapped.text },
          { status: mapped.status }
        );
      }
      const suspendFbRow = Array.isArray(suspendFb.data)
        ? suspendFb.data[0] ?? null
        : null;
      if (!suspendFbRow) {
        return NextResponse.json(
          { error: "Kullanıcı kaydı bulunamadı veya güncellenemedi." },
          { status: 404 }
        );
      }
      if (!rowLooksSuspended(suspendFbRow)) {
        return NextResponse.json(
          {
            error:
              "Askı doğrulanamadı. public.users üzerinde service_role için UPDATE / SELECT izinlerini kontrol edin.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (result.error) {
      logAdminMemberError("suspend_update_full", id, result.error);
      const mapped = publicErrorForDbError(
        result.error as PgishError,
        "suspend"
      );
      return NextResponse.json({ error: mapped.text }, { status: mapped.status });
    }
    if (!suspendRow) {
      return NextResponse.json(
        { error: "Kullanıcı kaydı bulunamadı veya güncellenemedi." },
        { status: 404 }
      );
    }
    if (!rowLooksSuspended(suspendRow)) {
      console.error("[admin/members PATCH]", {
        operation: "suspend_verify_state_mismatch",
        targetUserId: id,
        snapshot: suspendRow,
      });
      return NextResponse.json(
        {
          error:
            "Askı doğrulanamadı. public.users üzerinde service_role için UPDATE / SELECT izinlerini kontrol edin.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "reactivate") {
    console.error("[admin/members PATCH]", {
      phase: "reactivate_request",
      targetUserId: id,
    });

    const selectAfterReactivate =
      "id, is_platform_access_suspended, platform_access_suspended_at, platform_access_suspended_reason, updated_at";

    const reac = await publicUsersFrom(service)
      .update({
        is_platform_access_suspended: false,
        platform_access_suspended_at: null,
        platform_access_suspended_reason: null,
        updated_at: now,
      })
      .eq("id", id)
      .select(selectAfterReactivate)
      .single();

    console.log("REACTIVATE RESULT:", reac.data, reac.error);

    if (reac.error && isMissingColumnError(reac.error)) {
      const reacFb = await publicUsersFrom(service)
        .update({
          platform_access_suspended_at: null,
          updated_at: now,
        })
        .eq("id", id)
        .select(selectAfterReactivate)
        .single();
      console.log("REACTIVATE RESULT (fallback):", reacFb.data, reacFb.error);
      if (reacFb.error) {
        logAdminMemberError("reactivate_update_fallback", id, reacFb.error);
        const mapped = publicErrorForDbError(
          reacFb.error as PgishError,
          "reactivate"
        );
        return NextResponse.json(
          { error: mapped.text },
          { status: mapped.status }
        );
      }
      if (!reacFb.data) {
        return NextResponse.json(
          { error: "Kullanıcı kaydı bulunamadı veya güncellenemedi." },
          { status: 404 }
        );
      }
      if (rowLooksSuspended(reacFb.data)) {
        return NextResponse.json(
          {
            error:
              "Etkinleştirme doğrulanamadı. public.users üzerinde service_role için UPDATE / SELECT izinlerini kontrol edin.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (reac.error) {
      logAdminMemberError("reactivate_update_full", id, reac.error);
      const mapped = publicErrorForDbError(
        reac.error as PgishError,
        "reactivate"
      );
      return NextResponse.json(
        { error: mapped.text },
        { status: mapped.status }
      );
    }
    if (!reac.data) {
      return NextResponse.json(
        { error: "Kullanıcı kaydı bulunamadı veya güncellenemedi." },
        { status: 404 }
      );
    }
    if (rowLooksSuspended(reac.data)) {
      console.error("[admin/members PATCH]", {
        operation: "reactivate_verify_state_mismatch",
        targetUserId: id,
        snapshot: reac.data,
      });
      return NextResponse.json(
        {
          error:
            "Etkinleştirme doğrulanamadı. public.users üzerinde service_role için UPDATE / SELECT izinlerini kontrol edin.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  const { error: anonError } = await publicUsersFrom(service)
    .update({
      first_name: SILINMIS_KULLANICI_LABEL,
      last_name: null,
      nickname: null,
      display_name_mode: "real_name",
      avatar_url: null,
      email: null,
      birth_date: null,
      gender: null,
      phone: null,
      bio_61: null,
      admin_profile_anonymized_at: now,
      updated_at: now,
    })
    .eq("id", id);

  if (anonError) {
    logAdminMemberError("anonymize_full", id, anonError);
  }

  if (anonError && isMissingColumnError(anonError)) {
    const { error: slimError } = await publicUsersFrom(service)
      .update({
        first_name: SILINMIS_KULLANICI_LABEL,
        last_name: null,
        nickname: null,
        display_name_mode: "real_name",
        avatar_url: null,
        email: null,
        bio_61: null,
        admin_profile_anonymized_at: now,
        updated_at: now,
      })
      .eq("id", id);

    if (slimError) {
      logAdminMemberError("anonymize_slim", id, slimError);
      const mapped = publicErrorForDbError(
        slimError as PgishError,
        "anonymize"
      );
      return NextResponse.json(
        { error: mapped.text },
        { status: mapped.status }
      );
    }
  } else if (anonError) {
    const mapped = publicErrorForDbError(anonError as PgishError, "anonymize");
    return NextResponse.json({ error: mapped.text }, { status: mapped.status });
  }

  const { data: files, error: listErr } = await service.storage
    .from("avatars")
    .list(id);
  if (listErr) {
    console.error("[admin/members PATCH]", {
      operation: "anonymize_storage_list",
      targetUserId: id,
      code: listErr?.message,
    });
  } else if (files?.length) {
    const paths = files.map((f: { name: string }) => `${id}/${f.name}`);
    const { error: removeErr } = await service.storage
      .from("avatars")
      .remove(paths);
    if (removeErr) {
      console.error("[admin/members PATCH]", {
        operation: "anonymize_storage_remove",
        targetUserId: id,
        message: removeErr?.message,
      });
    }
  }

  return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/members PATCH]", {
      operation: "unhandled",
      targetUserId: targetUserId || "(parse_error)",
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return NextResponse.json(
      { error: ADMIN_FRIENDLY_ACTION_ERROR },
      { status: 500 }
    );
  }
}
