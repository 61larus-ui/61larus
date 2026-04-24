import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import {
  ADMIN_FRIENDLY_LIST_ERROR,
  isMissingColumnError,
} from "@/lib/admin-friendly-error";
import {
  combinedFullNameFromParts,
  resolveVisibleName,
  type DisplayNameModePref,
} from "@/lib/visible-name";

export type PlatformMemberRow = {
  id: string;
  display_label: string;
  /** public.users + auth.users birleşimi (OAuth’ta genelde auth tarafı dolu). */
  email: string | null;
  /** `public.users.full_name` (sütun yoksa null). */
  full_name: string | null;
  nickname: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name_mode: string | null;
  agreement_accepted: boolean | null;
  agreement_accepted_at: string | null;
  onboarding_completed_at: string | null;
  updated_at: string | null;
  /** public.users — doğrudan SELECT; null olabilir. */
  is_platform_access_suspended: boolean | null;
  platform_access_suspended_at: string | null;
  platform_access_suspended_reason: string | null;
  admin_profile_anonymized_at: string | null;
};

function displayLabelFromRow(row: {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  display_name_mode: string | null;
  email: string | null;
}): string {
  const fromCol =
    typeof row.full_name === "string" && row.full_name.trim().length > 0
      ? row.full_name.trim()
      : null;
  const full = fromCol ?? combinedFullNameFromParts(row.first_name, row.last_name);
  const dm = row.display_name_mode;
  const displayMode: DisplayNameModePref =
    dm === "nickname" || dm === "real_name" ? dm : null;
  return resolveVisibleName({
    fullName: full,
    nickname: row.nickname,
    displayMode,
    emailFallback: row.email,
  });
}

/**
 * Tek auth.admin.listUsers geçişi: gerçek hesap `id` kümesi + e-posta yedeği (yalnızca
 * `id` eşleşince kullanılır; e-posta ile public.users eşleştirilmez).
 */
async function buildAuthUserIndex(
  service: NonNullable<ReturnType<typeof createSupabaseServiceClient>>
): Promise<{
  emailById: Map<string, string>;
  /** `auth.users.id` (public.users.id ile birebir aynı olmalı). */
  authUserIds: string[];
}> {
  const emailById = new Map<string, string>();
  const authUserIds: string[] = [];
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      console.warn("[admin/members] auth.admin.listUsers:", error.message);
      break;
    }
    const users = data?.users ?? [];
    for (const u of users) {
      if (typeof u.id !== "string" || u.id.length === 0) continue;
      authUserIds.push(u.id);
      const mail = u.email;
      if (typeof mail === "string" && mail.trim().length > 0) {
        emailById.set(u.id, mail.trim());
      }
    }
    if (users.length < perPage) break;
    page += 1;
    if (page > 40) break;
  }
  return { emailById, authUserIds };
}

export async function GET() {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;

  const service = createSupabaseServiceClient();
  if (!service) {
    return NextResponse.json(
      {
        error: "Sunucu yapılandırması eksik. Destek ile iletişime geçin.",
      },
      { status: 503 }
    );
  }

  type UserRowFromDb = {
    id: string;
    email: string | null;
    agreement_accepted: boolean | null;
    is_platform_access_suspended: boolean | null;
    platform_access_suspended_reason: string | null;
    platform_access_suspended_at: string | null;
  };

  const userSelect = `
    id,
    email,
    agreement_accepted,
    is_platform_access_suspended,
    platform_access_suspended_reason,
    platform_access_suspended_at
  `;

  const withCreatedOrder = await service
    .from("users")
    .select(userSelect)
    .order("created_at", { ascending: false });

  let data: UserRowFromDb[] | null;
  let error = withCreatedOrder.error;

  if (error && isMissingColumnError(error)) {
    console.error(
      "[admin/members GET] order(created_at) failed; retrying without order",
      error
    );
    const noOrder = await service.from("users").select(userSelect);
    data = (noOrder.data ?? null) as UserRowFromDb[] | null;
    error = noOrder.error;
  } else {
    data = (withCreatedOrder.data ?? null) as UserRowFromDb[] | null;
  }

  console.log("ADMIN GET ERROR DEBUG", { data, error });
  console.log("ADMIN GET USERS:", data);

  if (error) {
    console.error("[admin/members GET] users query failed", error);
    return NextResponse.json(
      { error: ADMIN_FRIENDLY_LIST_ERROR },
      { status: 500 }
    );
  }

  const { emailById: authEmailById } = await buildAuthUserIndex(service);

  const rawRows = (data ?? []) as UserRowFromDb[];

  const members: PlatformMemberRow[] = rawRows.map((row) => {
    const publicEmail =
      typeof row.email === "string" && row.email.trim().length > 0
        ? row.email.trim()
        : null;
    const resolvedEmail = publicEmail ?? authEmailById.get(row.id) ?? null;
    const fullName = resolvedEmail;
    return {
      id: row.id,
      display_label: displayLabelFromRow({
        full_name: fullName,
        first_name: null,
        last_name: null,
        nickname: null,
        display_name_mode: null,
        email: resolvedEmail,
      }),
      email: resolvedEmail,
      full_name: fullName,
      nickname: null,
      first_name: null,
      last_name: null,
      display_name_mode: null,
      agreement_accepted:
        typeof row.agreement_accepted === "boolean"
          ? row.agreement_accepted
          : null,
      agreement_accepted_at: null,
      onboarding_completed_at: null,
      updated_at: null,
      is_platform_access_suspended: row.is_platform_access_suspended,
      platform_access_suspended_at: row.platform_access_suspended_at,
      platform_access_suspended_reason: row.platform_access_suspended_reason,
      admin_profile_anonymized_at: null,
    };
  });

  return NextResponse.json(
    { ok: true, members },
    {
      headers: {
        "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}
