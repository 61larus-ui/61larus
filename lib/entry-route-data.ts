import { unstable_noStore } from "next/cache";
import { cache } from "react";
import { SILINMIS_KULLANICI_LABEL } from "@/lib/deleted-user-label";
import {
  combinedFullNameFromParts,
  resolveVisibleName,
  type DisplayNameModePref,
} from "@/lib/visible-name";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { normalizeEntryCategory } from "@/lib/entry-category";
import { normalizeEntrySlug } from "@/lib/slug";
import { isRfc4122Uuid } from "@/lib/seo-entry-description";
import type { CommentItem, EntryItem } from "@/app/home-page-client";

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

function authorNameNicknameOrFullName(row: {
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
}): string | null {
  const nick =
    typeof row.nickname === "string" && row.nickname.trim().length > 0
      ? row.nickname.trim()
      : null;
  if (nick) return nick;
  const full = (combinedFullNameFromParts(row.first_name, row.last_name) ?? "").trim();
  return full.length > 0 ? full : null;
}

function sanitizeEntryTitle<T extends EntryItem>(entry: T): T {
  const title = entry.title ?? "";
  const limited = title.length > 161 ? title.slice(0, 161) : title;
  return { ...entry, title: limited };
}

export type EntryRow = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  category?: string | null;
  user_id?: string | null;
  slug?: string | null;
};

const ENTRY_ROW_SELECT =
  "id, title, content, created_at, category, user_id, slug" as const;

async function loadEntryRowById(
  client: Exclude<
    ReturnType<typeof createSupabaseServiceClient> | Awaited<
      ReturnType<typeof createSupabaseServerClient>
    >,
    null
  >,
  id: string
): Promise<EntryRow | null> {
  const { data, error } = await client
    .from("entries")
    .select(ENTRY_ROW_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as EntryRow;
}

export type EntryRouteDetail = {
  entry: EntryItem;
  comments: CommentItem[];
};

type SupabaseForEntry = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type DbClient = Exclude<
  ReturnType<typeof createSupabaseServiceClient> | Awaited<
    ReturnType<typeof createSupabaseServerClient>
  >,
  null
>;

/**
 * 1) `entries.slug` ile doğrudan eşleşme (önce URL segment’i, gerekirse normalize biçim).
 * Çok satır varsa ilk kayıt alınır.
 */
async function loadEntryBySlugExact(
  client: DbClient,
  slugValue: string
): Promise<EntryRow | null> {
  const v = slugValue.trim();
  if (!v) return null;

  const res = await client
    .from("entries")
    .select(ENTRY_ROW_SELECT)
    .eq("slug", v)
    .limit(1);

  if (
    res.error &&
    /slug|column|schema|not exist/i.test(res.error.message ?? "")
  ) {
    return null;
  }
  if (res.error) {
    console.warn("[entry-route] slug.eq lookup", res.error.message);
    return null;
  }
  const row = res.data?.[0];
  return row ? (row as EntryRow) : null;
}

/**
 * Slug çözüm sırası (404 yalnızca gerçekten yoksa):
 * 1. Tam slug eşleşmesi (decoded → normalize edilmiş, farklıysa ikinci deneme)
 * 2. Segment RFC UUID ise id eşleşmesi
 * 3. normalize(slug) / normalize(title) ile sınırlı tarama (eski/null slug kayıtları)
 */
async function resolveEntryRowWithClient(
  client: DbClient,
  raw: string
): Promise<EntryRow | null> {
  const decodedSlug = decodeSlugSegment(raw);
  if (!decodedSlug) return null;

  const targetSlug = normalizeEntrySlug(decodedSlug);

  const byDecoded = await loadEntryBySlugExact(client, decodedSlug);
  if (byDecoded) {
    return byDecoded;
  }

  if (targetSlug.length > 0 && targetSlug !== decodedSlug) {
    const byNormalized = await loadEntryBySlugExact(client, targetSlug);
    if (byNormalized) {
      return byNormalized;
    }
  }

  if (isRfc4122Uuid(decodedSlug)) {
    const byId = await loadEntryRowById(client, decodedSlug);
    if (byId) {
      return byId;
    }
  }

  const { data, error } = await client
    .from("entries")
    .select(ENTRY_ROW_SELECT)
    .order("created_at", { ascending: false })
    .limit(2500);

  if (error) {
    console.warn(
      "[entry-route] resolveEntryRowWithClient fallback scan",
      error.message
    );
    return null;
  }

  for (const rowRaw of data ?? []) {
    const row = rowRaw as EntryRow;
    if (entryRowMatchesSlugResolution(row, targetSlug, decodedSlug)) {
      return row;
    }
  }

  return null;
}

/** Slug/UUID → entry satırı (sayfa aşaması). */
export async function resolveEntryRowBySegment(
  raw: string
): Promise<EntryRow | null> {
  unstable_noStore();
  const supabase = await createSupabaseServerClient();
  const client = (createSupabaseServiceClient() ?? supabase) as DbClient;
  return resolveEntryRowWithClient(client, raw);
}

/**
 * Giriş sayfası hızı: yorum sorgusu yok; yazar için en fazla 1 yorum (fallback uid)
 * + ilgili kullanıcı(lar) çekilir. İçerik anında ekranlanabilir; yorumlar ayrı RSC.
 */
export async function buildEntryItemFast(
  supabase: SupabaseForEntry,
  row: EntryRow
): Promise<EntryItem> {
  const entryUid =
    typeof row.user_id === "string" && row.user_id.length > 0
      ? row.user_id
      : null;

  let fallbackUid: string | null = null;
  if (!entryUid) {
    const c = await supabase
      .from("comments")
      .select("user_id")
      .eq("entry_id", row.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    fallbackUid =
      c.data && typeof c.data.user_id === "string" && c.data.user_id.length > 0
        ? c.data.user_id
        : null;
  }

  const userIds = [
    ...new Set(
      [entryUid, fallbackUid].filter(
        (u): u is string => typeof u === "string" && u.length > 0
      )
    ),
  ];

  const authorInfoByUserId = new Map<
    string,
    {
      authorLabel: string;
      nicknameOrFullName: string | null;
      bio61: string | null;
    }
  >();

  if (userIds.length > 0) {
    const userLookupClient = (createSupabaseServiceClient() ??
      supabase) as typeof supabase;
    const { data: usersRows } = await userLookupClient
      .from("users")
      .select(
        "id, nickname, first_name, last_name, display_name_mode, email, bio_61"
      )
      .in("id", userIds);
    for (const u of usersRows ?? []) {
      if (typeof u.id === "string") {
        const rawBio = u.bio_61;
        const bio61 =
          typeof rawBio === "string" && rawBio.trim().length > 0
            ? rawBio.trim()
            : null;
        authorInfoByUserId.set(u.id, {
          authorLabel: authorLabelFromUserRow(u),
          nicknameOrFullName: authorNameNicknameOrFullName(u),
          bio61,
        });
      }
    }
  }

  const slugVal =
    typeof row.slug === "string" && row.slug.trim().length > 0
      ? row.slug.trim()
      : null;
  const rawCat =
    typeof row.category === "string" && row.category.trim().length > 0
      ? row.category.trim()
      : null;
  const cat = normalizeEntryCategory(rawCat);

  const base: EntryItem = sanitizeEntryTitle({
    id: row.id,
    title: row.title,
    content: row.content,
    created_at: row.created_at,
    category: cat,
    slug: slugVal,
  });

  if (entryUid) {
    const info = authorInfoByUserId.get(entryUid);
    if (info) {
      const authorName = info.nicknameOrFullName ?? info.authorLabel ?? null;
      return { ...base, authorName, bio61: info.bio61, slug: slugVal };
    }
    return { ...base, authorName: null, bio61: null, slug: slugVal };
  }
  if (typeof fallbackUid === "string" && fallbackUid.length > 0) {
    const info = authorInfoByUserId.get(fallbackUid);
    if (info) {
      return {
        ...base,
        authorName: info.authorLabel,
        bio61: info.bio61,
        slug: slugVal,
      };
    }
    return {
      ...base,
      authorName: SILINMIS_KULLANICI_LABEL,
      bio61: null,
      slug: slugVal,
    };
  }
  return { ...base, slug: slugVal };
}

/** Giriş sayfası: slug → satır + EntryItem (yorum sorgusu yok). */
async function getEntryShellBySlugUncached(
  raw: string
): Promise<{ entry: EntryItem; row: EntryRow } | null> {
  unstable_noStore();
  const supabase = await createSupabaseServerClient();
  const client = (createSupabaseServiceClient() ?? supabase) as DbClient;
  const row = await resolveEntryRowWithClient(client, raw);
  if (!row) {
    return null;
  }
  const entry = await buildEntryItemFast(supabase, row);
  return { entry, row };
}

/** Aynı istek içinde generateMetadata + page tek DB yolunu paylaşır. */
export const getEntryShellBySlug = cache(getEntryShellBySlugUncached);

/** Tüm yorum satırları + yazar etiketleri (ayrı Suspense aşaması). */
export async function getCommentItemsForEntryRow(
  supabase: SupabaseForEntry,
  row: EntryRow
): Promise<CommentItem[]> {
  const { data: commentsData, error: commentsError } = await supabase
    .from("comments")
    .select(
      "id, entry_id, user_id, content, created_at, parent_comment_id, reply_to_user_id, reply_to_username"
    )
    .eq("entry_id", row.id)
    .order("created_at", { ascending: true });

  if (commentsError) {
    console.warn("[entry-route] comments", commentsError.message);
  }

  const commentsChrono = [...(commentsData ?? [])].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const entryAuthorUserIdByEntryId = new Map<string, string>();
  for (const c of commentsChrono) {
    if (!entryAuthorUserIdByEntryId.has(c.entry_id)) {
      entryAuthorUserIdByEntryId.set(c.entry_id, c.user_id);
    }
  }

  const commentUserIds = [
    ...new Set((commentsData ?? []).map((c) => c.user_id).filter(Boolean)),
  ] as string[];

  const entryUid =
    typeof row.user_id === "string" && row.user_id.length > 0
      ? row.user_id
      : null;
  const fallbackUid = entryAuthorUserIdByEntryId.get(row.id) ?? null;
  const userIdsForAuthor = [
    ...new Set(
      [entryUid, fallbackUid, ...commentUserIds].filter(
        (u): u is string => typeof u === "string" && u.length > 0
      )
    ),
  ];

  const authorInfoByUserId = new Map<
    string,
    {
      authorLabel: string;
      nicknameOrFullName: string | null;
      bio61: string | null;
    }
  >();

  if (userIdsForAuthor.length > 0) {
    const userLookupClient = (createSupabaseServiceClient() ??
      supabase) as typeof supabase;
    const { data: usersRows } = await userLookupClient
      .from("users")
      .select(
        "id, nickname, first_name, last_name, display_name_mode, email, bio_61"
      )
      .in("id", userIdsForAuthor);
    for (const u of usersRows ?? []) {
      if (typeof u.id === "string") {
        const rawBio = u.bio_61;
        const bio61 =
          typeof rawBio === "string" && rawBio.trim().length > 0
            ? rawBio.trim()
            : null;
        authorInfoByUserId.set(u.id, {
          authorLabel: authorLabelFromUserRow(u),
          nicknameOrFullName: authorNameNicknameOrFullName(u),
          bio61,
        });
      }
    }
  }

  return (commentsData ?? []).map((c) => {
    const info = authorInfoByUserId.get(c.user_id);
    const authorLabel = info?.authorLabel ?? SILINMIS_KULLANICI_LABEL;
    const bio61 = info?.bio61 ?? null;
    return {
      ...c,
      authorLabel,
      bio61,
    } as CommentItem;
  });
}

async function buildDetailFromRow(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  row: EntryRow
): Promise<EntryRouteDetail | null> {
  const { data: commentsData, error: commentsError } = await supabase
    .from("comments")
    .select(
      "id, entry_id, user_id, content, created_at, parent_comment_id, reply_to_user_id, reply_to_username"
    )
    .eq("entry_id", row.id)
    .order("created_at", { ascending: true });

  if (commentsError) {
    console.warn("[entry-route] comments", commentsError.message);
  }

  const commentsChrono = [...(commentsData ?? [])].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const entryAuthorUserIdByEntryId = new Map<string, string>();
  for (const c of commentsChrono) {
    if (!entryAuthorUserIdByEntryId.has(c.entry_id)) {
      entryAuthorUserIdByEntryId.set(c.entry_id, c.user_id);
    }
  }

  const commentUserIds = [
    ...new Set((commentsData ?? []).map((c) => c.user_id).filter(Boolean)),
  ] as string[];

  const entryUid =
    typeof row.user_id === "string" && row.user_id.length > 0
      ? row.user_id
      : null;
  const fallbackUid = entryAuthorUserIdByEntryId.get(row.id) ?? null;
  const userIdsForAuthor = [
    ...new Set(
      [entryUid, fallbackUid, ...commentUserIds].filter(
        (u): u is string => typeof u === "string" && u.length > 0
      )
    ),
  ];

  const authorInfoByUserId = new Map<
    string,
    {
      authorLabel: string;
      nicknameOrFullName: string | null;
      bio61: string | null;
    }
  >();

  if (userIdsForAuthor.length > 0) {
    const userLookupClient = (createSupabaseServiceClient() ??
      supabase) as typeof supabase;
    const { data: usersRows } = await userLookupClient
      .from("users")
      .select(
        "id, nickname, first_name, last_name, display_name_mode, email, bio_61"
      )
      .in("id", userIdsForAuthor);
    for (const u of usersRows ?? []) {
      if (typeof u.id === "string") {
        const rawBio = u.bio_61;
        const bio61 =
          typeof rawBio === "string" && rawBio.trim().length > 0
            ? rawBio.trim()
            : null;
        authorInfoByUserId.set(u.id, {
          authorLabel: authorLabelFromUserRow(u),
          nicknameOrFullName: authorNameNicknameOrFullName(u),
          bio61,
        });
      }
    }
  }

  const slugVal =
    typeof row.slug === "string" && row.slug.trim().length > 0
      ? row.slug.trim()
      : null;
  const rawCat =
    typeof row.category === "string" && row.category.trim().length > 0
      ? row.category.trim()
      : null;
  const cat = normalizeEntryCategory(rawCat);

  const base: EntryItem = sanitizeEntryTitle({
    id: row.id,
    title: row.title,
    content: row.content,
    created_at: row.created_at,
    category: cat,
    slug: slugVal,
  });

  const entryItem: EntryItem = (() => {
    if (entryUid) {
      const info = authorInfoByUserId.get(entryUid);
      if (info) {
        const authorName = info.nicknameOrFullName ?? info.authorLabel ?? null;
        return { ...base, authorName, bio61: info.bio61, slug: slugVal };
      }
      return { ...base, authorName: null, bio61: null, slug: slugVal };
    }
    if (typeof fallbackUid === "string" && fallbackUid.length > 0) {
      const info = authorInfoByUserId.get(fallbackUid);
      if (info) {
        return {
          ...base,
          authorName: info.authorLabel,
          bio61: info.bio61,
          slug: slugVal,
        };
      }
      return {
        ...base,
        authorName: SILINMIS_KULLANICI_LABEL,
        bio61: null,
        slug: slugVal,
      };
    }
    return { ...base, slug: slugVal };
  })();

  const comments: CommentItem[] = (commentsData ?? []).map((c) => {
    const info = authorInfoByUserId.get(c.user_id);
    const authorLabel = info?.authorLabel ?? SILINMIS_KULLANICI_LABEL;
    const bio61 = info?.bio61 ?? null;
    return {
      ...c,
      authorLabel,
      bio61,
    } as CommentItem;
  });

  return { entry: entryItem, comments };
}

function decodeSlugSegment(segment: string): string {
  const t = segment.trim();
  if (!t) return "";
  try {
    return decodeURIComponent(t).trim();
  } catch {
    return t;
  }
}

function entryRowMatchesSlugResolution(
  row: EntryRow,
  targetSlug: string,
  decodedSlug: string
): boolean {
  if (row.id === decodedSlug) return true;
  if (
    targetSlug.length > 0 &&
    normalizeEntrySlug(row.slug ?? "") === targetSlug
  ) {
    return true;
  }
  if (
    targetSlug.length > 0 &&
    normalizeEntrySlug(row.title ?? "") === targetSlug
  ) {
    return true;
  }
  return false;
}

/**
 * Slug segment → tam satır + yorumlar (tekil sayfa içeriği).
 * Çözüm sırası: `resolveEntryRowWithClient` ile aynı (slug → UUID id → title/slug normalize tarama).
 */
export async function getEntryDetailBySlug(
  segment: string
): Promise<EntryRouteDetail | null> {
  unstable_noStore();
  const supabase = await createSupabaseServerClient();
  const client = (createSupabaseServiceClient() ?? supabase) as DbClient;

  const row = await resolveEntryRowWithClient(client, segment);
  if (!row) {
    return null;
  }
  return buildDetailFromRow(supabase, row);
}

export async function getEntryDetailById(
  id: string
): Promise<EntryRouteDetail | null> {
  unstable_noStore();
  const supabase = await createSupabaseServerClient();
  const client = (createSupabaseServiceClient() ?? supabase) as Exclude<
    typeof supabase,
    null
  >;
  const row = await loadEntryRowById(client, id);
  if (!row) return null;
  return buildDetailFromRow(supabase, row);
}
