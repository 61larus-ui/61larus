import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
import type { PostgrestError } from "@supabase/supabase-js";
import { ensureUniqueEntrySlug, slugifyEntryTitle } from "@/lib/entry-slug";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { normalizeEntryCategory } from "@/lib/entry-category";
import {
  combinedFullNameFromParts,
  resolveVisibleName,
  type DisplayNameModePref,
} from "@/lib/visible-name";
import { countPublicLiveEntries } from "@/lib/entry-public-live-count";

type EntryListRow = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  category: string | null;
  slug: string | null;
};

function logEntriesDebugPgErr(step: string, err: PostgrestError | null) {
  if (!err) return;
  const ext = err as PostgrestError & { status?: number };
  console.error("[admin/entries-debug]", step, {
    message: err.message,
    code: err.code,
    details: err.details,
    hint: err.hint,
    status: ext.status,
  });
  console.error("[admin/entries-debug]", step + "_raw_json", JSON.stringify(err));
}

function authorLabelFromUserRow(row: {
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  display_name_mode: string | null;
  email: string | null;
}): string {
  const full = combinedFullNameFromParts(row.first_name, row.last_name);
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

export async function GET() {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;

  const service = createSupabaseServiceClient();
  if (!service) {
    return NextResponse.json(
      {
        error:
          "Entry listesi için SUPABASE_SERVICE_ROLE_KEY tanımlanmalıdır.",
      },
      { status: 503 }
    );
  }

  {
    const who = await service.rpc("debug_admin_pg_session_invoker");
    if (who.error) {
      logEntriesDebugPgErr("a_b_rpc_debug_admin_pg_session_invoker", who.error);
    } else {
      console.error(
        "[admin/entries-debug] a_b_current_user_schema_jwt_claim",
        who.data
      );
    }

    const cnt = await service
      .from("entries")
      .select("*", { head: true, count: "exact" });
    console.error("[admin/entries-debug] c_count_response_meta", {
      count: cnt.count,
      status: cnt.status,
      hasError: Boolean(cnt.error),
    });
    if (cnt.error) {
      logEntriesDebugPgErr("c_count_public_entries_head", cnt.error);
    } else {
      console.error(
        "[admin/entries-debug] c_count_public_entries",
        cnt.count ?? null
      );
    }

    const one = await service.from("entries").select("id").limit(1);
    if (one.error) {
      logEntriesDebugPgErr("d_from_entries_select_id_limit_1", one.error);
    } else {
      console.error(
        "[admin/entries-debug] d_from_entries_select_id_limit_1_rows",
        (one.data ?? []).length
      );
    }
  }

  const publicLiveEntryCount = await countPublicLiveEntries(service);

  let rows: EntryListRow[] = [];
  const withCat = await service
    .from("entries")
    .select("id, title, content, created_at, category, slug")
    .order("created_at", { ascending: false })
    .limit(500);

  if (withCat.error && /slug|column|schema|not exist/i.test(withCat.error.message)) {
    const noSlug = await service
      .from("entries")
      .select("id, title, content, created_at, category")
      .order("created_at", { ascending: false })
      .limit(500);
    if (noSlug.error) {
      return NextResponse.json(
        { error: noSlug.error.message || "Liste alınamadı." },
        { status: 500 }
      );
    }
    rows = (noSlug.data ?? []).map((r) => ({
      ...(r as Omit<EntryListRow, "slug">),
      slug: null,
    })) as EntryListRow[];
  } else if (withCat.error) {
    const plain = await service
      .from("entries")
      .select("id, title, content, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (plain.error) {
      return NextResponse.json(
        { error: plain.error.message || "Liste alınamadı." },
        { status: 500 }
      );
    }
    rows = (plain.data ?? []).map((r) => ({
      ...(r as Omit<EntryListRow, "category" | "slug">),
      category: null,
      slug: null,
    })) as EntryListRow[];
  } else {
    rows = (withCat.data ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        ...r,
        slug: typeof row.slug === "string" && row.slug.trim() ? row.slug.trim() : null,
      } as EntryListRow;
    });
  }

  const ids = rows.map((r) => r.id);
  const authorByEntryId: Record<string, string> = {};

  if (ids.length > 0) {
    const { data: comments } = await service
      .from("comments")
      .select("entry_id, user_id, created_at")
      .in("entry_id", ids)
      .order("created_at", { ascending: true });

    const firstUser = new Map<string, string>();
    for (const c of comments ?? []) {
      const eid = c.entry_id as string;
      const uid = c.user_id as string;
      if (eid && uid && !firstUser.has(eid)) firstUser.set(eid, uid);
    }
    const userIds = [...new Set(firstUser.values())];
    if (userIds.length > 0) {
      const { data: users } = await service
        .from("users")
        .select(
          "id, first_name, last_name, nickname, display_name_mode, email"
        )
        .in("id", userIds);

      type UserRow = {
        id: string;
        first_name: string | null;
        last_name: string | null;
        nickname: string | null;
        display_name_mode: string | null;
        email: string | null;
      };
      const byId = new Map<string, UserRow>(
        (users ?? []).map((u: UserRow) => [u.id, u])
      );
      for (const [eid, uid] of firstUser) {
        const u = byId.get(uid);
        authorByEntryId[eid] = u ? authorLabelFromUserRow(u) : "—";
      }
    }
  }

  return NextResponse.json({
    ok: true,
    entries: rows,
    authorByEntryId,
    publicLiveEntryCount,
  });
}

export async function POST(req: Request) {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;

  let body: { title?: string; content?: string; category?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const categoryRaw = body.category;
  const categoryTrim =
    typeof categoryRaw === "string" && categoryRaw.trim().length > 0
      ? categoryRaw.trim()
      : null;
  const category = categoryTrim
    ? normalizeEntryCategory(categoryTrim) ?? null
    : null;

  if (!title || !content) {
    return NextResponse.json(
      { error: "Başlık ve içerik zorunludur." },
      { status: 400 }
    );
  }

  const service = createSupabaseServiceClient();
  if (!service) {
    return NextResponse.json(
      {
        error:
          "Entry oluşturmak için SUPABASE_SERVICE_ROLE_KEY tanımlanmalıdır.",
      },
      { status: 503 }
    );
  }

  const newId = randomUUID();
  const baseSlug = slugifyEntryTitle(title, newId);
  const slug = await ensureUniqueEntrySlug(service, baseSlug);

  const baseInsert = { id: newId, title, content, slug };
  const withCategory = category
    ? { ...baseInsert, category }
    : baseInsert;

  let ins = await service
    .from("entries")
    .insert([withCategory])
    .select("id, title, content, category, created_at, slug");
  if (ins.error && /category/i.test(ins.error.message)) {
    ins = await service
      .from("entries")
      .insert([baseInsert])
      .select("id, title, content, category, created_at, slug");
  }
  if (ins.error && /slug|column|schema|not exist/i.test(ins.error.message)) {
    ins = await service
      .from("entries")
      .insert([category ? { id: newId, title, content, category } : { id: newId, title, content }])
      .select("id, title, content, category, created_at");
  }
  if (ins.error && /category/i.test(ins.error.message)) {
    ins = await service
      .from("entries")
      .insert([{ id: newId, title, content }])
      .select("id, title, content, created_at");
  }

  if (ins.error) {
    return NextResponse.json(
      { error: ins.error.message || "Kayıt oluşturulamadı." },
      { status: 500 }
    );
  }

  const created = ins.data?.[0] as
    | {
        id: string;
        title: string;
        content: string;
        category?: string | null;
        created_at: string;
        slug?: string | null;
      }
    | undefined;
  if (created) {
    console.log("[admin/entries POST] created", {
      id: created.id,
      title: created.title,
      content:
        typeof created.content === "string"
          ? `${created.content.slice(0, 120)}${created.content.length > 120 ? "…" : ""}`
          : created.content,
      category: created.category ?? null,
      created_at: created.created_at,
      slug: created.slug ?? null,
    });
  }

  return NextResponse.json({
    ok: true,
    id: created?.id ?? null,
    slug:
      typeof created?.slug === "string" && created.slug.trim().length > 0
        ? created.slug.trim()
        : null,
  });
}
