import type { Metadata } from "next";
import { Suspense } from "react";
import HomePageClient from "./home-page-client";
import { SILINMIS_KULLANICI_LABEL } from "@/lib/deleted-user-label";
import {
  combinedFullNameFromParts,
  resolveVisibleName,
  type DisplayNameModePref,
} from "@/lib/visible-name";
import {
  buildEntryMetaDescription,
  isRfc4122Uuid,
} from "@/lib/seo-entry-description";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { isMissingColumnError } from "@/lib/admin-friendly-error";
import { normalizeEntryCategory } from "@/lib/entry-category";

export const dynamic = "force-dynamic";

const SITE_LABEL = "61LARUS";

type HomePageSearchParams = Promise<{
  entry?: string | string[];
}>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: HomePageSearchParams;
}): Promise<Metadata> {
  const params = await searchParams;
  const raw = params.entry;
  const entryParam = Array.isArray(raw) ? raw[0] : raw;
  if (entryParam == null || typeof entryParam !== "string") {
    return {};
  }

  const id = decodeURIComponent(entryParam.trim());
  if (!isRfc4122Uuid(id)) {
    return {
      robots: { index: false, follow: true },
    };
  }

  const supabase = await createSupabaseServerClient();
  const entriesClient = createSupabaseServiceClient() ?? supabase;
  const { data, error } = await entriesClient
    .from("entries")
    .select("id, title, content")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return {
      robots: { index: false, follow: true },
    };
  }

  const titleRaw = typeof data.title === "string" ? data.title : "";
  const contentRaw = typeof data.content === "string" ? data.content : "";
  const entryTitle = titleRaw.trim();
  const description = buildEntryMetaDescription(entryTitle, contentRaw);
  const pageTitle =
    entryTitle.length > 0 ? `${entryTitle} | ${SITE_LABEL}` : SITE_LABEL;

  return {
    title: pageTitle,
    description: description.length > 0 ? description : undefined,
    openGraph: {
      title: pageTitle,
      description: description.length > 0 ? description : undefined,
    },
    twitter: {
      card: "summary",
      title: pageTitle,
      description: description.length > 0 ? description : undefined,
    },
    robots: { index: true, follow: true },
  };
}

type EntryItem = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  category?: string | null;
  /** Display author: entry.user_id (nickname/full name) or first comment author */
  authorName?: string | null;
  bio61?: string | null;
};

type CommentItem = {
  id: string;
  entry_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_comment_id: string | null;
  reply_to_user_id: string | null;
  reply_to_username: string | null;
  authorLabel: string;
  bio61?: string | null;
};

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

/** Entry author when `entries.user_id` is set: nickname, else full name. */
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

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  /** entries: admin service_role ile yazılır; RLS anon’u kesiyorsa tam liste için service okuma (yalnız sunucu). */
  const entriesSupabase = createSupabaseServiceClient() ?? supabase;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialAgreementDone = false;
  let initialOnboardingDone = false;
  let initialPlatformAccessSuspended = false;
  let profileAvatarFromRow: string | null = null;
  let profileNicknameFromRow: string | null = null;
  let profileFullNameFromRow: string | null = null;
  let profileDisplayModeFromRow: "nickname" | "real_name" | null = null;
  if (user) {
    const baseProfileSelect =
      "agreement_accepted, agreement_accepted_at, onboarding_completed_at, avatar_url, nickname, first_name, last_name, display_name_mode, email";

    const rProfile1 = await supabase
      .from("users")
      .select(
        `${baseProfileSelect}, is_platform_access_suspended, platform_access_suspended_at`
      )
      .eq("id", user.id)
      .maybeSingle();

    type HomeUserProfile = {
      first_name?: string | null;
      agreement_accepted?: boolean | null;
      agreement_accepted_at?: string | null;
      onboarding_completed_at?: string | null;
      avatar_url?: string | null;
      nickname?: string | null;
      last_name?: string | null;
      display_name_mode?: string | null;
      email?: string | null;
      is_platform_access_suspended?: boolean | null;
      platform_access_suspended_at?: string | null;
    };

    let profile: HomeUserProfile | null = null;

    if (!rProfile1.error && rProfile1.data) {
      profile = rProfile1.data as HomeUserProfile;
    } else if (rProfile1.error && isMissingColumnError(rProfile1.error)) {
      const rProfile2 = await supabase
        .from("users")
        .select(`${baseProfileSelect}, platform_access_suspended_at`)
        .eq("id", user.id)
        .maybeSingle();
      if (!rProfile2.error && rProfile2.data) {
        profile = rProfile2.data as HomeUserProfile;
      } else if (rProfile2.error && isMissingColumnError(rProfile2.error)) {
        const rProfile3 = await supabase
          .from("users")
          .select(baseProfileSelect)
          .eq("id", user.id)
          .maybeSingle();
        if (!rProfile3.error) {
          profile = rProfile3.data as HomeUserProfile;
        }
      }
    }

    {
      if (profile) {
        if (profile.is_platform_access_suspended === true) {
          initialPlatformAccessSuspended = true;
        } else if (profile.is_platform_access_suspended === false) {
          initialPlatformAccessSuspended = false;
        } else {
          initialPlatformAccessSuspended =
            typeof profile.platform_access_suspended_at === "string" &&
            profile.platform_access_suspended_at.length > 0;
        }
      } else {
        initialPlatformAccessSuspended = false;
      }
    }
    {
      const isSelfServiceAnonymized =
        profile?.first_name === SILINMIS_KULLANICI_LABEL;
      if (isSelfServiceAnonymized) {
        /* Hesabını sil: aynı auth id; sözleşme taşınmamış sayılmalı. */
        initialAgreementDone = false;
        initialOnboardingDone = false;
      } else {
        if (typeof profile?.agreement_accepted === "boolean") {
          initialAgreementDone = profile.agreement_accepted === true;
        } else {
          /* Legacy: sadece boolean yoksa zaman damgası */
          initialAgreementDone = !!profile?.agreement_accepted_at;
        }
        initialOnboardingDone = !!profile?.onboarding_completed_at;
      }
    }
    const u = profile?.avatar_url;
    profileAvatarFromRow = typeof u === "string" && u.length > 0 ? u : null;
    const nick = profile?.nickname;
    profileNicknameFromRow =
      typeof nick === "string" && nick.trim().length > 0 ? nick.trim() : null;
    profileFullNameFromRow = combinedFullNameFromParts(
      profile?.first_name,
      profile?.last_name
    );
    const dm = profile?.display_name_mode;
    profileDisplayModeFromRow =
      dm === "nickname" || dm === "real_name" ? dm : null;
  }

  let entryRows: {
    id: string;
    title: string;
    content: string;
    created_at: string;
    category?: string | null;
    user_id?: string | null;
  }[] = [];
  let entriesError: { message: string } | null = null;

  {
    type EntryRow = (typeof entryRows)[number];

    async function loadEntriesWithCategoryAndOptionalUserId(): Promise<{
      rows: EntryRow[];
      error: { message: string } | null;
    }> {
      let res = await entriesSupabase
        .from("entries")
        .select("id, title, content, created_at, category, user_id")
        .order("created_at", { ascending: false });
      if (
        res.error &&
        /user_id/i.test(res.error.message ?? "") &&
        /column|schema|not exist|could not find/i.test(res.error.message ?? "")
      ) {
        const fb = await entriesSupabase
          .from("entries")
          .select("id, title, content, created_at, category")
          .order("created_at", { ascending: false });
        return {
          rows: (fb.data ?? []).map((r) => ({
            ...r,
            user_id: null as string | null,
          })) as EntryRow[],
          error: fb.error,
        };
      }
      return {
        rows: (res.data ?? []) as EntryRow[],
        error: res.error,
      };
    }

    let { rows, error } = await loadEntriesWithCategoryAndOptionalUserId();

    if (error && /category/i.test(error.message ?? "")) {
      const catWithUid = await entriesSupabase
        .from("entries")
        .select("id, title, content, created_at, user_id")
        .order("created_at", { ascending: false });
      const catFinal =
        catWithUid.error &&
        /user_id/i.test(catWithUid.error.message ?? "") &&
        /column|schema|not exist|could not find/i.test(catWithUid.error.message ?? "")
          ? await entriesSupabase
              .from("entries")
              .select("id, title, content, created_at")
              .order("created_at", { ascending: false })
          : catWithUid;
      entryRows = (catFinal.data ?? []).map((r) => {
        const uid =
          r && typeof r === "object" && "user_id" in r
            ? (r as { user_id: string | null }).user_id
            : null;
        return {
          ...r,
          category: null as string | null,
          user_id: uid,
        };
      }) as EntryRow[];
      entriesError = catFinal.error;
    } else {
      entryRows = rows;
      entriesError = error;
    }

    console.log("[home/entries fetch]", {
      rowCount: entryRows.length,
      client: entriesSupabase === supabase ? "anon_session" : "service_role",
      error: entriesError?.message ?? null,
      sample: entryRows.slice(0, 8).map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category ?? null,
        created_at: r.created_at,
      })),
    });
  }

  const { data: comments, error: commentsError } = await supabase
    .from("comments")
    .select(
      "id, entry_id, user_id, content, created_at, parent_comment_id, reply_to_user_id, reply_to_username"
    )
    .order("created_at", { ascending: false });

  const commentUserIds = [
    ...new Set((comments ?? []).map((c) => c.user_id).filter(Boolean)),
  ] as string[];

  /** Entry → user via existing `comments` relation (earliest comment = display author). */
  const entryAuthorUserIdByEntryId = new Map<string, string>();
  const commentsChrono = [...(comments ?? [])].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  for (const c of commentsChrono) {
    if (!entryAuthorUserIdByEntryId.has(c.entry_id)) {
      entryAuthorUserIdByEntryId.set(c.entry_id, c.user_id);
    }
  }

  const entryRowUserIds = (entryRows ?? [])
    .map((r) => r.user_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const userIdsForAuthorLabels = [
    ...new Set([...commentUserIds, ...entryRowUserIds]),
  ];

  const authorInfoByUserId = new Map<
    string,
    {
      authorLabel: string;
      nicknameOrFullName: string | null;
      bio61: string | null;
    }
  >();
  if (userIdsForAuthorLabels.length > 0) {
    const userLookupClient =
      createSupabaseServiceClient() ?? supabase;
    const { data: commentUsers } = await userLookupClient
      .from("users")
      .select(
        "id, first_name, last_name, nickname, display_name_mode, email, bio_61"
      )
      .in("id", userIdsForAuthorLabels);
    const returnedIds = new Set(
      (commentUsers ?? [])
        .map((u) => u.id)
        .filter((id): id is string => typeof id === "string")
    );
    if (returnedIds.size < userIdsForAuthorLabels.length) {
      const missing = userIdsForAuthorLabels.filter((id) => !returnedIds.has(id));
      console.warn("[home/comments] user rows missing for some comment authors", {
        distinctAuthorIds: userIdsForAuthorLabels.length,
        rowsReturned: returnedIds.size,
        missingUserIdCount: missing.length,
      });
    }
    for (const u of commentUsers ?? []) {
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

  if (entriesError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12">
        <p className="max-w-md text-center text-sm leading-6 text-[#667085]">
          Hata: {entriesError.message}
        </p>
      </div>
    );
  }

  if (commentsError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12">
        <p className="max-w-md text-center text-sm leading-6 text-[#667085]">
          Hata: {commentsError.message}
        </p>
      </div>
    );
  }

  const commentsByEntryId = (comments ?? []).reduce<Record<string, CommentItem[]>>(
    (acc, comment) => {
      if (!acc[comment.entry_id]) {
        acc[comment.entry_id] = [];
      }

      const info = authorInfoByUserId.get(comment.user_id);
      const authorLabel = info?.authorLabel ?? SILINMIS_KULLANICI_LABEL;
      const bio61 = info?.bio61 ?? null;
      acc[comment.entry_id].push({
        ...comment,
        authorLabel,
        bio61,
      });
      return acc;
    },
    {}
  );

  function entryItemFromRow(row: {
    id: string;
    title: string;
    content: string;
    created_at: string;
    category?: string | null;
    user_id?: string | null;
  }): EntryItem {
    const raw =
      typeof row.category === "string" && row.category.trim().length > 0
        ? row.category.trim()
        : null;
    const cat = normalizeEntryCategory(raw);
    const base = sanitizeEntryTitle({
      id: row.id,
      title: row.title,
      content: row.content,
      created_at: row.created_at,
      category: cat,
    });

    const entryUid =
      typeof row.user_id === "string" && row.user_id.length > 0
        ? row.user_id
        : null;
    if (entryUid) {
      const info = authorInfoByUserId.get(entryUid);
      if (info) {
        const authorName =
          info.nicknameOrFullName ?? info.authorLabel ?? null;
        return { ...base, authorName, bio61: info.bio61 };
      }
      return { ...base, authorName: null, bio61: null };
    }

    const uid = entryAuthorUserIdByEntryId.get(row.id);
    if (typeof uid === "string" && uid.length > 0) {
      const info = authorInfoByUserId.get(uid);
      if (info) {
        return {
          ...base,
          authorName: info.authorLabel,
          bio61: info.bio61,
        };
      }
      return {
        ...base,
        authorName: SILINMIS_KULLANICI_LABEL,
        bio61: null,
      };
    }
    return base;
  }

  const fromDb = (entryRows ?? []).map((row) => entryItemFromRow(row));

  const mergedList = [...fromDb].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const userEmail = user?.email ?? null;
  const meta = user?.user_metadata as {
    avatar_url?: string;
    user_name?: string;
  } | undefined;
  const oauthAvatarUrl =
    typeof meta?.avatar_url === "string" && meta.avatar_url.length > 0
      ? meta.avatar_url
      : null;
  return (
    <Suspense fallback={null}>
      <HomePageClient
        leftEntries={mergedList}
        centerEntries={mergedList}
        rightEntries={mergedList}
        commentsByEntryId={commentsByEntryId}
        isAuthenticated={!!user}
        authUserId={user?.id ?? null}
        initialAgreementDone={initialAgreementDone}
        initialOnboardingDone={initialOnboardingDone}
        initialPlatformAccessSuspended={initialPlatformAccessSuspended}
        userEmail={userEmail}
        profileAvatarUrl={profileAvatarFromRow}
        oauthAvatarUrl={oauthAvatarUrl}
        profileNickname={profileNicknameFromRow}
        profileFullName={profileFullNameFromRow}
        profileDisplayMode={profileDisplayModeFromRow}
      />
    </Suspense>
  );
}
