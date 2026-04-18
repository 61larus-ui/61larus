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
  const { data, error } = await supabase
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
  authorLabel?: string | null;
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

function sanitizeEntryTitle<T extends EntryItem>(entry: T): T {
  const title = entry.title ?? "";
  const limited = title.length > 161 ? title.slice(0, 161) : title;
  return { ...entry, title: limited };
}

export default async function Home() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialAgreementDone = false;
  let initialOnboardingDone = false;
  let profileAvatarFromRow: string | null = null;
  let profileNicknameFromRow: string | null = null;
  let profileFullNameFromRow: string | null = null;
  let profileDisplayModeFromRow: "nickname" | "real_name" | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select(
        "agreement_accepted_at, onboarding_completed_at, avatar_url, nickname, first_name, last_name, display_name_mode, email"
      )
      .eq("id", user.id)
      .maybeSingle();
    initialAgreementDone = !!profile?.agreement_accepted_at;
    initialOnboardingDone = !!profile?.onboarding_completed_at;
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

  const { data: latestEntries, error: latestError } = await supabase
    .from("entries")
    .select("id, title, content, created_at")
    .order("created_at", { ascending: false });

  const { data: sidebarEntries, error: sidebarError } = await supabase
    .from("entries")
    .select("id, title, content, created_at")
    .order("created_at", { ascending: false });

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

  const userIdsForAuthorLabels = commentUserIds;

  const authorInfoByUserId = new Map<
    string,
    { authorLabel: string; bio61: string | null }
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
          bio61,
        });
      }
    }
  }

  if (latestError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12">
        <p className="max-w-md text-center text-sm leading-6 text-[#667085]">
          Hata: {latestError.message}
        </p>
      </div>
    );
  }

  if (sidebarError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12">
        <p className="max-w-md text-center text-sm leading-6 text-[#667085]">
          Hata: {sidebarError.message}
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
  }): EntryItem {
    const base = sanitizeEntryTitle({
      id: row.id,
      title: row.title,
      content: row.content,
      created_at: row.created_at,
    });
    const uid = entryAuthorUserIdByEntryId.get(row.id);
    if (typeof uid === "string" && uid.length > 0) {
      const info = authorInfoByUserId.get(uid);
      if (info) {
        return { ...base, authorLabel: info.authorLabel, bio61: info.bio61 };
      }
      return {
        ...base,
        authorLabel: SILINMIS_KULLANICI_LABEL,
        bio61: null,
      };
    }
    return base;
  }

  const fromDb = (latestEntries ?? sidebarEntries ?? []).map((row) =>
    entryItemFromRow(row)
  );

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
        initialAgreementDone={initialAgreementDone}
        initialOnboardingDone={initialOnboardingDone}
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
