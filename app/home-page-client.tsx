"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthPanel from "@/components/auth-panel";
import AgreementPanel from "@/components/agreement-panel";
import { anonymizeCurrentUserAccount } from "@/lib/anonymize-account";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  combinedFullNameFromParts,
  resolveVisibleName,
  type DisplayNameModePref,
} from "@/lib/visible-name";
import {
  FEED_CATEGORY_OPTIONS,
  type FeedCategoryFilter,
} from "@/lib/entry-category";
import { FeedEntryCard } from "./feed-entry-card";

const LS_PENDING_ENTRY = "pendingEntryId";
const LS_PENDING_ACTION = "pendingAction";

/** Center feed pagination (initial + each “Daha fazla yükle” batch). */
const FEED_PAGE_SIZE = 12;

/** 8-4-4-4-12 hex id shape (matches Postgres uuid text form, including v4/v7 and non-RFC variants). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRealUuid(value: string) {
  return UUID_RE.test(value);
}

/** Demo/seed or non-UUID ids: never call Supabase for reactions/comments tied to these rows. */
function isSeedId(value: string) {
  return value.startsWith("seed-") || !isRealUuid(value);
}

/** Extract @handles for mention notifications (detection only; text unchanged). */
function extractMentionUsernames(text: string): string[] {
  const re = /@([\p{L}\p{N}_]+)/gu;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let raw = m[1].trim().replace(/^[.,;:!?]+|[.,;:!?]+$/g, "");
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

/** ILIKE pattern for exact, case-insensitive nickname match (escape %, _, \\). */
function escapeForIlikeExact(token: string): string {
  return token
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

/** Resolve mention tokens to user ids via public.users.nickname (public @handle). */
async function resolveMentionedUserIds(
  supabase: SupabaseBrowser,
  tokens: string[]
): Promise<string[]> {
  if (tokens.length === 0) return [];
  const ids = new Set<string>();
  await Promise.all(
    tokens.map(async (token) => {
      const pattern = escapeForIlikeExact(token);
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .ilike("nickname", pattern)
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("MENTION USER LOOKUP ERROR", error);
        return;
      }
      if (data && typeof data.id === "string") ids.add(data.id);
    })
  );
  return [...ids];
}

function readPendingFromStorage(): { entryId: string | null; action: string | null } {
  if (typeof window === "undefined") {
    return { entryId: null, action: null };
  }
  return {
    entryId: localStorage.getItem(LS_PENDING_ENTRY),
    action: localStorage.getItem(LS_PENDING_ACTION),
  };
}

function writePendingReturn(entryId: string, action: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_PENDING_ENTRY, entryId);
  localStorage.setItem(LS_PENDING_ACTION, action);
}

function clearPendingReturn() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_PENDING_ENTRY);
  localStorage.removeItem(LS_PENDING_ACTION);
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

type NotificationInsert = {
  user_id: string;
  actor_user_id: string | null;
  type: "comment_reply" | "mention";
  entry_id: string | null;
  comment_id: string | null;
};

type NotificationQueryRow = {
  id: string;
  type: string;
  is_read: boolean;
  created_at: string;
  entry_id: string | null;
  comment_id: string | null;
  actor_user_id: string | null;
};

type ReactionType = "like" | "dislike";

type ReactionSummary = {
  likes: number;
  dislikes: number;
  mine: ReactionType | null;
};

type ReactionsModalState = {
  open: boolean;
  type: "entry" | "comment";
  id: string | null;
  tab: ReactionType;
};

const REACTIONS_MODAL_INITIAL: ReactionsModalState = {
  open: false,
  type: "entry",
  id: null,
  tab: "like",
};

type ReactionModalUserRow = {
  userId: string;
  label: string;
  avatarUrl: string | null;
};

export type CenterMode =
  | "feed"
  | "entry"
  | "auth"
  | "agreement"
  | "notifications";

type Props = {
  leftEntries: EntryItem[];
  centerEntries: EntryItem[];
  rightEntries: EntryItem[];
  commentsByEntryId: Record<string, CommentItem[]>;
  isAuthenticated: boolean;
  initialAgreementDone: boolean;
  initialOnboardingDone: boolean;
  userEmail: string | null;
  /** Saved upload from `users.avatar_url` — highest priority for header avatar */
  profileAvatarUrl: string | null;
  /** OAuth provider image from session metadata — fallback only */
  oauthAvatarUrl: string | null;
  /** Combined `users.first_name` + `last_name` */
  profileFullName: string | null;
  /** Saved `users.nickname` */
  profileNickname: string | null;
  /** `users.display_name_mode` */
  profileDisplayMode: "nickname" | "real_name" | null;
};

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleString("tr-TR");
}

const TR_MONTH_SHORT = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
] as const;

function formatNotificationCompactClock(d: Date): string {
  const day = d.getDate();
  const mon = TR_MONTH_SHORT[d.getMonth()] ?? "";
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${day} ${mon} ${hh}:${mm}`;
}

/** Turkish relative / compact time for notification rows (no extra deps). */
function formatNotificationTime(createdAt: string): string {
  const d = new Date(createdAt);
  const t = d.getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  if (diff < 0) return formatNotificationCompactClock(d);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "az önce";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const hours = Math.floor(sec / 3600);
  if (hours < 24) return `${hours} sa önce`;
  return formatNotificationCompactClock(d);
}

function entryPublicUrl(entryId: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/?entry=${encodeURIComponent(entryId)}`;
}

function labelFromUserRow(row: {
  email: string | null;
  avatar_url: string | null;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  display_name_mode: string | null;
}): { label: string; avatarUrl: string | null } {
  const full = combinedFullNameFromParts(row.first_name, row.last_name);
  const dm = row.display_name_mode;
  const displayMode: DisplayNameModePref =
    dm === "nickname" || dm === "real_name" ? dm : null;
  const label = resolveVisibleName({
    fullName: full,
    nickname: row.nickname,
    displayMode,
    emailFallback: row.email,
  });
  const av = row.avatar_url;
  const avatarUrl = typeof av === "string" && av.length > 0 ? av : null;
  return { label, avatarUrl };
}

export default function HomePageClient({
  leftEntries,
  centerEntries,
  rightEntries,
  commentsByEntryId,
  isAuthenticated,
  initialAgreementDone,
  initialOnboardingDone,
  userEmail,
  profileAvatarUrl,
  oauthAvatarUrl,
  profileFullName,
  profileNickname,
  profileDisplayMode,
}: Props) {
  const headerDisplayName = useMemo(
    () =>
      resolveVisibleName({
        fullName: profileFullName,
        nickname: profileNickname,
        displayMode: profileDisplayMode,
        emailFallback: userEmail,
      }),
    [profileDisplayMode, profileFullName, profileNickname, userEmail]
  );

  const headerInitial = useMemo(() => {
    const ch = headerDisplayName.trim().charAt(0);
    return ch ? ch.toUpperCase() : "?";
  }, [headerDisplayName]);

  const router = useRouter();
  const searchParams = useSearchParams();

  const stripEntryQueryFromUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (!sp.has("entry")) return;
    sp.delete("entry");
    const next = sp.toString();
    const path = window.location.pathname;
    void router.replace(next ? `${path}?${next}` : path, { scroll: false });
  }, [router]);
  const [commentText, setCommentText] = useState("");
  const [commentComposeFocused, setCommentComposeFocused] = useState(false);
  const commentComposeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [entryReactionSummaries, setEntryReactionSummaries] = useState<
    Record<string, ReactionSummary>
  >({});
  const [commentReactionSummaries, setCommentReactionSummaries] = useState<
    Record<string, ReactionSummary>
  >({});
  const [reactionsModal, setReactionsModal] = useState<ReactionsModalState>(
    REACTIONS_MODAL_INITIAL
  );
  const [reactionsModalUsers, setReactionsModalUsers] = useState<ReactionModalUserRow[]>(
    []
  );
  const [reactionsModalLoading, setReactionsModalLoading] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return readPendingFromStorage().entryId;
  });
  const [centerMode, setCenterMode] = useState<CenterMode>("feed");
  const [feedCategoryFilter, setFeedCategoryFilter] =
    useState<FeedCategoryFilter>("all");
  const [feedVisibleCount, setFeedVisibleCount] = useState(FEED_PAGE_SIZE);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountDeleteStep, setAccountDeleteStep] = useState<"idle" | "confirm">(
    "idle"
  );
  const [accountDeleteLoading, setAccountDeleteLoading] = useState(false);
  const [accountDeleteError, setAccountDeleteError] = useState<string | null>(
    null
  );
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const notificationsMenuRef = useRef<HTMLDivElement>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [headerNotifications, setHeaderNotifications] = useState<
    {
      id: string;
      type: string;
      is_read: boolean;
      created_at: string;
      entry_id: string | null;
      comment_id: string | null;
      actor_user_id: string | null;
      /** @handle line: nickname when set, else visible name */
      actorMentionHandle: string | null;
      /** `resolveVisibleName` — görünen ad (başlık satırı) */
      actorDisplayName: string | null;
      entryTitle: string | null;
    }[]
  >([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsFetchError, setNotificationsFetchError] = useState(false);

  const commentsPropsFingerprint = useMemo(
    () =>
      Object.keys(commentsByEntryId)
        .sort()
        .map((k) => {
          const list = commentsByEntryId[k] ?? [];
          return `${k}:${list.map((c) => c.id).join(",")}`;
        })
        .join("|"),
    [commentsByEntryId]
  );

  const [commentsByEntryIdLive, setCommentsByEntryIdLive] =
    useState(commentsByEntryId);
  const commentsPropsFpRef = useRef("");
  useEffect(() => {
    if (commentsPropsFpRef.current === commentsPropsFingerprint) return;
    commentsPropsFpRef.current = commentsPropsFingerprint;
    setCommentsByEntryIdLive(commentsByEntryId);
  }, [commentsByEntryId, commentsPropsFingerprint]);

  const unreadNotificationCount = useMemo(
    () => headerNotifications.filter((n) => !n.is_read).length,
    [headerNotifications]
  );

  const fetchHeaderNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setNotificationsLoading(true);
    setNotificationsFetchError(false);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rows, error } = await supabase
        .from("notifications")
        .select(
          "id, type, is_read, created_at, entry_id, comment_id, actor_user_id"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const list = (rows ?? []) as NotificationQueryRow[];
      const actorIds = [
        ...new Set(
          list
            .map((r: NotificationQueryRow) => r.actor_user_id)
            .filter(
              (id: string | null): id is string =>
                typeof id === "string" && id.length > 0
            )
        ),
      ];
      const actorMentionHandleById: Record<string, string> = {};
      const actorDisplayNameById: Record<string, string> = {};
      if (actorIds.length > 0) {
        const { data: actors, error: actErr } = await supabase
          .from("users")
          .select(
            "id, first_name, last_name, nickname, display_name_mode, email"
          )
          .in("id", actorIds);
        if (!actErr && actors) {
          for (const u of actors) {
            if (typeof u.id !== "string") continue;
            const dm = u.display_name_mode;
            const displayMode: DisplayNameModePref =
              dm === "nickname" || dm === "real_name" ? dm : null;
            const nick =
              typeof u.nickname === "string" && u.nickname.trim().length > 0
                ? u.nickname.trim()
                : "";
            const visible = resolveVisibleName({
              fullName: combinedFullNameFromParts(u.first_name, u.last_name),
              nickname: u.nickname,
              displayMode,
              emailFallback: u.email,
            }).trim();
            const handle = nick || visible;
            if (handle.length > 0) {
              actorMentionHandleById[u.id] = handle;
            }
            if (visible.length > 0) {
              actorDisplayNameById[u.id] = visible;
            } else if (handle.length > 0) {
              actorDisplayNameById[u.id] = handle;
            }
          }
        }
      }

      const entryIds = [
        ...new Set(
          list
            .map((r: NotificationQueryRow) => r.entry_id)
            .filter(
              (id: string | null): id is string =>
                typeof id === "string" && id.length > 0
            )
        ),
      ];
      const entryTitleById: Record<string, string> = {};
      if (entryIds.length > 0) {
        const { data: entryRows, error: entErr } = await supabase
          .from("entries")
          .select("id, title")
          .in("id", entryIds);
        if (!entErr && entryRows) {
          for (const e of entryRows) {
            if (typeof e.id !== "string") continue;
            const title =
              typeof e.title === "string" && e.title.trim().length > 0
                ? e.title.trim()
                : "";
            if (title) entryTitleById[e.id] = title;
          }
        }
      }

      setHeaderNotifications(
        list.map((r: NotificationQueryRow) => ({
          id: r.id,
          type: r.type,
          is_read: Boolean(r.is_read),
          created_at: r.created_at,
          entry_id: r.entry_id ?? null,
          comment_id: r.comment_id ?? null,
          actor_user_id: r.actor_user_id ?? null,
          actorMentionHandle: r.actor_user_id
            ? actorMentionHandleById[r.actor_user_id] ?? null
            : null,
          actorDisplayName: r.actor_user_id
            ? actorDisplayNameById[r.actor_user_id] ?? null
            : null,
          entryTitle: r.entry_id ? entryTitleById[r.entry_id] ?? null : null,
        }))
      );
    } catch {
      setHeaderNotifications([]);
      setNotificationsFetchError(true);
    } finally {
      setNotificationsLoading(false);
    }
  }, [isAuthenticated]);

  const markNotificationsAsRead = useCallback(
    async (ids: string[]): Promise<void> => {
      if (ids.length === 0) return;
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .in("id", ids)
          .eq("user_id", user.id);
        if (error) {
          return;
        }
      } catch {
        return;
      }
    },
    []
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setHeaderNotifications([]);
      setNotificationsOpen(false);
      setNotificationsFetchError(false);
      return;
    }
    void fetchHeaderNotifications();
  }, [isAuthenticated, fetchHeaderNotifications]);

  useEffect(() => {
    if (!notificationsOpen || notificationsLoading || !isAuthenticated) {
      return;
    }
    const unreadIds = headerNotifications
      .filter((n) => !n.is_read)
      .map((n) => n.id);
    if (unreadIds.length === 0) return;
    setHeaderNotifications((prev) =>
      prev.map((n) =>
        unreadIds.includes(n.id) ? { ...n, is_read: true } : n
      )
    );
    void markNotificationsAsRead(unreadIds);
  }, [
    notificationsOpen,
    notificationsLoading,
    headerNotifications,
    isAuthenticated,
    markNotificationsAsRead,
  ]);

  useEffect(() => {
    if (!notificationsOpen) return;
    function onPointerDown(e: MouseEvent) {
      const el = notificationsMenuRef.current;
      if (el && !el.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [notificationsOpen]);

  const [agreementDone, setAgreementDone] = useState(initialAgreementDone);
  const [onboardingDone, setOnboardingDone] = useState(initialOnboardingDone);

  const agreementDoneRef = useRef(agreementDone);
  const onboardingDoneRef = useRef(onboardingDone);
  const isAuthenticatedRef = useRef(isAuthenticated);
  /** Until RSC shows a signed-out user, skip agreement routing + prop merge that can fight logout/delete. */
  const postSignOutHardResetRef = useRef(false);
  agreementDoneRef.current = agreementDone;
  onboardingDoneRef.current = onboardingDone;
  isAuthenticatedRef.current = isAuthenticated;

  useEffect(() => {
    if (!isAuthenticated) {
      postSignOutHardResetRef.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (postSignOutHardResetRef.current) {
      setAgreementDone(false);
      setOnboardingDone(false);
      return;
    }
    // Same pattern as onboarding: never let a stale RSC tick clear optimistic agreement
    // (e.g. right after accept + refresh), or routing forces agreement again and drops entry restore.
    setAgreementDone((prev) =>
      isAuthenticated ? initialAgreementDone || prev : initialAgreementDone
    );
    setOnboardingDone((prev) =>
      isAuthenticated ? initialOnboardingDone || prev : initialOnboardingDone
    );
  }, [initialAgreementDone, initialOnboardingDone, isAuthenticated]);

  // Stable callback + refs for gate flags so post-onboarding code can call this in the
  // same tick as setOnboardingDone without a stale closure (same mutations as a click).
  const selectEntry = useCallback((id: string) => {
    // Source of truth: persist immediately on every entry click so pending survives
    // auth redirect, router.refresh, and re-renders until successful open clears it.
    writePendingReturn(id, "comment");
    setSelectedEntryId(id);
    if (!isAuthenticatedRef.current) {
      setCenterMode("auth");
      return;
    }
    if (agreementDoneRef.current) {
      setCenterMode("feed");
      if (readPendingFromStorage().entryId === id) {
        clearPendingReturn();
      }
    }
  }, []);

  const closeEntryModal = useCallback(() => {
    clearPendingReturn();
    setSelectedEntryId(null);
    setCenterMode("feed");
    stripEntryQueryFromUrl();
  }, [stripEntryQueryFromUrl]);

  const goToBrandHome = useCallback(() => {
    setFeedCategoryFilter("all");
    closeEntryModal();
  }, [closeEntryModal]);

  useEffect(() => {
    const raw = searchParams.get("entry");
    const urlEntryId =
      raw && isRealUuid(decodeURIComponent(raw.trim()))
        ? decodeURIComponent(raw.trim())
        : null;
    if (urlEntryId) {
      writePendingReturn(urlEntryId, "comment");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isAuthenticated || !agreementDone) return;

    const raw = searchParams.get("entry");
    const urlEntryId =
      raw && isRealUuid(decodeURIComponent(raw.trim()))
        ? decodeURIComponent(raw.trim())
        : null;
    const { entryId: storedId } = readPendingFromStorage();
    const entryId = urlEntryId ?? storedId;
    if (!entryId) return;

    const combined = [...centerEntries, ...leftEntries, ...rightEntries];
    if (combined.length === 0) {
      return;
    }

    if (!combined.some((e) => e.id === entryId)) {
      clearPendingReturn();
      setSelectedEntryId(null);
      setCenterMode("feed");
      stripEntryQueryFromUrl();
      return;
    }

    selectEntry(entryId);
  }, [
    isAuthenticated,
    agreementDone,
    centerMode,
    centerEntries,
    leftEntries,
    rightEntries,
    selectEntry,
    searchParams,
    stripEntryQueryFromUrl,
  ]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "INITIAL_SESSION") return;
      router.refresh();
    });
    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!accountMenuOpen) {
      setAccountDeleteStep("idle");
      setAccountDeleteError(null);
      return;
    }
    function onPointerDown(e: MouseEvent) {
      const el = accountMenuRef.current;
      if (el && !el.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [accountMenuOpen]);

  useEffect(() => {
    setFeedVisibleCount(FEED_PAGE_SIZE);
  }, [feedCategoryFilter]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (centerMode === "agreement") {
        setCenterMode("feed");
      }
      return;
    }
    if (postSignOutHardResetRef.current) {
      return;
    }
    if (!agreementDone) {
      setCenterMode("agreement");
      return;
    }
    if (centerMode === "auth") {
      const { entryId } = readPendingFromStorage();
      if (entryId) {
        selectEntry(entryId);
      } else {
        setCenterMode("feed");
      }
    }
  }, [isAuthenticated, agreementDone, centerMode, selectedEntryId, selectEntry]);

  const persistStateBeforeOAuth = useCallback(() => {
    const id = selectedEntryId ?? centerEntries[0]?.id ?? null;
    if (!id) return;
    writePendingReturn(id, "comment");
  }, [selectedEntryId, centerEntries]);

  async function requireAuthForComment(): Promise<void> {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      const id = selectedEntryId ?? centerEntries[0]?.id ?? null;
      if (id) writePendingReturn(id, "comment");
      setCenterMode("auth");
    }
  }

  const effectiveEntryId = useMemo(() => selectedEntryId, [selectedEntryId]);

  const selectedEntry = useMemo(() => {
    if (!effectiveEntryId) return null;
    const all = [...centerEntries, ...leftEntries, ...rightEntries];
    return all.find((item) => item.id === effectiveEntryId) ?? null;
  }, [effectiveEntryId, centerEntries, leftEntries, rightEntries]);

  const selectedComments = selectedEntry
    ? (commentsByEntryIdLive[selectedEntry.id] ?? [])
    : [];

  async function submitComment() {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    if (isSubmittingComment) return;
    if (!selectedEntry) return;
    if (isSeedId(selectedEntry.id)) return;

    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      await requireAuthForComment();
      return;
    }

    setIsSubmittingComment(true);
    try {
      // check if user exists in public.users
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!existingUser) {
        console.log("USER NOT IN public.users → inserting");

        const userEmail = user.email ?? null;

        const { error: ensureUserError } = await supabase
          .from("users")
          .upsert(
            {
              id: user.id,
              email: userEmail,
            },
            { onConflict: "id" }
          );

        if (ensureUserError) {
          console.error("COMMENT SUBMIT ERROR", ensureUserError);
          return;
        }
      }

      const { data: insertedComment, error } = await supabase
        .from("comments")
        .insert({
          entry_id: selectedEntry.id,
          user_id: user.id,
          content: trimmed.slice(0, 161),
          parent_comment_id: null,
          reply_to_user_id: null,
          reply_to_username: null,
        })
        .select("id")
        .single();

      if (error) {
        console.error("COMMENT SUBMIT ERROR", error);
        return;
      }

      const newCommentId = insertedComment?.id;

      try {
        const mentionTokens = extractMentionUsernames(trimmed);
        if (mentionTokens.length > 0 && newCommentId) {
          const mentionedUserIds = await resolveMentionedUserIds(
            supabase,
            mentionTokens
          );
          const mentionPayloads: NotificationInsert[] = [];
          const seenRecipient = new Set<string>();
          for (const mentionedId of mentionedUserIds) {
            if (mentionedId === user.id) continue;
            if (seenRecipient.has(mentionedId)) continue;
            seenRecipient.add(mentionedId);
            mentionPayloads.push({
              user_id: mentionedId,
              actor_user_id: user.id,
              type: "mention",
              entry_id: selectedEntry.id,
              comment_id: newCommentId,
            });
          }
          if (mentionPayloads.length > 0) {
            const { error: mentionInsErr } = await supabase
              .from("notifications")
              .insert(mentionPayloads);
            if (mentionInsErr) {
              console.error(
                "MENTION NOTIFICATION INSERT ERROR",
                mentionInsErr
              );
            }
          }
        }
      } catch (mentionErr) {
        console.error("MENTION NOTIFICATION ERROR", mentionErr);
      }

      setCommentText("");
      await router.refresh();
    } catch (error) {
      console.error("COMMENT SUBMIT ERROR", error);
    } finally {
      setIsSubmittingComment(false);
    }
  }

  const allEntryIds = useMemo(() => {
    const s = new Set<string>();
    for (const e of leftEntries) s.add(e.id);
    for (const e of centerEntries) s.add(e.id);
    for (const e of rightEntries) s.add(e.id);
    return [...s].sort();
  }, [leftEntries, centerEntries, rightEntries]);

  const mostCommentedEntries = useMemo(() => {
    const ranked = centerEntries.map((entry) => ({
      entry,
      commentCount: commentsByEntryIdLive[entry.id]?.length ?? 0,
    }));
    ranked.sort((a, b) => b.commentCount - a.commentCount);
    return ranked.slice(0, 10).map((row) => row.entry);
  }, [centerEntries, commentsByEntryIdLive]);

  const feedEntriesFiltered = useMemo(() => {
    return centerEntries;
  }, [centerEntries]);

  const centerFeedEntries = useMemo(
    () => feedEntriesFiltered.slice(0, feedVisibleCount),
    [feedEntriesFiltered, feedVisibleCount]
  );

  const feedHasMore = feedVisibleCount < feedEntriesFiltered.length;

  const refreshEntryReactions = useCallback(async () => {
    const ids = allEntryIds;
    if (ids.length === 0) {
      setEntryReactionSummaries({});
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const myId = user?.id ?? null;
    const next: Record<string, ReactionSummary> = {};
    for (const id of ids) {
      next[id] = { likes: 0, dislikes: 0, mine: null };
    }
    const dbIds = ids.filter((id) => !isSeedId(id));
    if (dbIds.length === 0) {
      setEntryReactionSummaries(next);
      return;
    }
    const { data, error } = await supabase
      .from("entry_reactions")
      .select("entry_id, reaction_type, user_id")
      .in("entry_id", dbIds);
    if (error) {
      console.warn("entry_reactions", error.message);
      return;
    }
    for (const row of data ?? []) {
      const eid = row.entry_id as string;
      if (!next[eid]) next[eid] = { likes: 0, dislikes: 0, mine: null };
      if (row.reaction_type === "like") next[eid].likes += 1;
      else if (row.reaction_type === "dislike") next[eid].dislikes += 1;
      if (myId && row.user_id === myId) {
        next[eid].mine = row.reaction_type as ReactionType;
      }
    }
    setEntryReactionSummaries(next);
  }, [allEntryIds]);

  const refreshCommentReactions = useCallback(async (commentIds: string[]) => {
    if (commentIds.length === 0) {
      setCommentReactionSummaries({});
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const myId = user?.id ?? null;
    const next: Record<string, ReactionSummary> = {};
    for (const cid of commentIds) {
      next[cid] = { likes: 0, dislikes: 0, mine: null };
    }
    const dbIds = commentIds.filter((id) => !isSeedId(id));
    if (dbIds.length === 0) {
      setCommentReactionSummaries(next);
      return;
    }
    const { data, error } = await supabase
      .from("comment_reactions")
      .select("comment_id, reaction_type, user_id")
      .in("comment_id", dbIds);
    if (error) {
      console.warn("comment_reactions", error.message);
      return;
    }
    for (const row of data ?? []) {
      const cid = row.comment_id as string;
      if (!next[cid]) next[cid] = { likes: 0, dislikes: 0, mine: null };
      if (row.reaction_type === "like") next[cid].likes += 1;
      else if (row.reaction_type === "dislike") next[cid].dislikes += 1;
      if (myId && row.user_id === myId) {
        next[cid].mine = row.reaction_type as ReactionType;
      }
    }
    setCommentReactionSummaries(next);
  }, []);

  useEffect(() => {
    void refreshEntryReactions();
  }, [refreshEntryReactions, isAuthenticated]);

  const selectedCommentIdsKey = useMemo(
    () => selectedComments.map((c) => c.id).sort().join(","),
    [selectedComments]
  );

  useEffect(() => {
    if (!selectedCommentIdsKey) {
      setCommentReactionSummaries({});
      return;
    }
    void refreshCommentReactions(selectedCommentIdsKey.split(","));
  }, [selectedCommentIdsKey, refreshCommentReactions, isAuthenticated]);

  function requireAuthForReaction(entryId: string | null): void {
    if (!isAuthenticated) {
      if (entryId) writePendingReturn(entryId, "comment");
      setCenterMode("auth");
    }
  }

  function requireAuthForCommentReaction(): void {
    if (!isAuthenticated) {
      const id = selectedEntryId ?? centerEntries[0]?.id ?? null;
      if (id) writePendingReturn(id, "comment");
      setCenterMode("auth");
    }
  }

  useEffect(() => {
    if (!reactionsModal.open || !reactionsModal.id) {
      setReactionsModalUsers([]);
      setReactionsModalLoading(false);
      return;
    }
    if (isSeedId(reactionsModal.id)) {
      setReactionsModalUsers([]);
      setReactionsModalLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    const load = async () => {
      setReactionsModalLoading(true);
      setReactionsModalUsers([]);
      const table =
        reactionsModal.type === "entry"
          ? "entry_reactions"
          : "comment_reactions";
      const idField =
        reactionsModal.type === "entry" ? "entry_id" : "comment_id";

      const { data, error } = await supabase
        .from(table)
        .select(
          "user_id, users(id, email, avatar_url, first_name, last_name, nickname, display_name_mode)"
        )
        .eq(idField, reactionsModal.id)
        .eq("reaction_type", reactionsModal.tab);

      if (cancelled) return;
      if (error) {
        console.warn("reactions modal", error.message);
        setReactionsModalUsers([]);
        setReactionsModalLoading(false);
        return;
      }

      type UserEmbed = {
        id: string;
        email: string | null;
        avatar_url: string | null;
        first_name: string | null;
        last_name: string | null;
        nickname: string | null;
        display_name_mode: string | null;
      };
      const list: ReactionModalUserRow[] = [];
      for (const raw of data ?? []) {
        const row = raw as {
          user_id: string;
          users: UserEmbed | UserEmbed[] | null;
        };
        if (!row.user_id) continue;
        const u = row.users;
        const profile = Array.isArray(u) ? u[0] : u;
        if (!profile) {
          list.push({ userId: row.user_id, label: "kullanıcı", avatarUrl: null });
          continue;
        }
        const { label, avatarUrl } = labelFromUserRow(profile);
        list.push({ userId: row.user_id, label, avatarUrl });
      }
      setReactionsModalUsers(list);
      setReactionsModalLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [reactionsModal]);

  const toggleEntryReaction = async (entryId: string, type: ReactionType) => {
    requireAuthForReaction(entryId);
    if (!isAuthenticated) return;
    if (isSeedId(entryId)) return;
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: row } = await supabase
      .from("entry_reactions")
      .select("id, reaction_type")
      .eq("entry_id", entryId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!row) {
      const { error } = await supabase.from("entry_reactions").insert({
        entry_id: entryId,
        user_id: user.id,
        reaction_type: type,
      });
      if (error) console.error(error);
    } else if (row.reaction_type === type) {
      await supabase.from("entry_reactions").delete().eq("id", row.id);
    } else {
      await supabase
        .from("entry_reactions")
        .update({ reaction_type: type })
        .eq("id", row.id);
    }
    await refreshEntryReactions();
  };

  const toggleCommentReaction = async (commentId: string, type: ReactionType) => {
    requireAuthForCommentReaction();
    if (!isAuthenticated) return;
    if (isSeedId(commentId)) return;
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: row } = await supabase
      .from("comment_reactions")
      .select("id, reaction_type")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!row) {
      const { error } = await supabase.from("comment_reactions").insert({
        comment_id: commentId,
        user_id: user.id,
        reaction_type: type,
      });
      if (error) console.error("comment_reactions insert", error);
    } else if (row.reaction_type === type) {
      const { error: delError } = await supabase
        .from("comment_reactions")
        .delete()
        .eq("id", row.id);
      if (delError) console.error("comment_reactions delete", delError);
    } else {
      const { error: updError } = await supabase
        .from("comment_reactions")
        .update({ reaction_type: type })
        .eq("id", row.id);
      if (updError) console.error("comment_reactions update", updError);
    }
    await refreshCommentReactions(selectedComments.map((c) => c.id));
  };

  const copyEntryLink = (entryId: string, title: string) => {
    const url = entryPublicUrl(entryId);
    void navigator.clipboard.writeText(`${title}\n${url}`);
  };

  const shareWhatsApp = (entryId: string, title: string) => {
    const link = entryPublicUrl(entryId);
    const text = encodeURIComponent(`${title} ${link}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const shareX = (entryId: string, title: string) => {
    const link = entryPublicUrl(entryId);
    const text = encodeURIComponent(title);
    const url = encodeURIComponent(link);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  async function onAgreementSuccess() {
    setAgreementDone(true);
    setOnboardingDone(true);
    agreementDoneRef.current = true;
    onboardingDoneRef.current = true;

    const pending = readPendingFromStorage();
    if (pending?.entryId) {
      selectEntry(pending.entryId);
    } else {
      setCenterMode("feed");
    }

    await router.refresh();
  }

  async function resetSessionToGuest() {
    const supabase = createSupabaseBrowserClient();
    postSignOutHardResetRef.current = true;
    agreementDoneRef.current = false;
    onboardingDoneRef.current = false;
    isAuthenticatedRef.current = false;
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      localStorage.clear();
      sessionStorage.clear();
    }
    clearPendingReturn();
    setCenterMode("feed");
    setSelectedEntryId(null);
    setAgreementDone(false);
    setOnboardingDone(false);
    await router.refresh();
  }

  async function handleLogout() {
    setAccountMenuOpen(false);
    await resetSessionToGuest();
  }

  async function handleConfirmAccountDeletion() {
    setAccountDeleteError(null);
    setAccountDeleteLoading(true);
    try {
      const { error: delError } = await anonymizeCurrentUserAccount();
      if (delError) {
        setAccountDeleteError(delError);
        return;
      }
      setAccountMenuOpen(false);
      await resetSessionToGuest();
    } finally {
      setAccountDeleteLoading(false);
    }
  }

  function renderCenterPanels() {
    if (centerMode === "auth") {
      return <AuthPanel onBeforeOAuth={persistStateBeforeOAuth} />;
    }
    if (centerMode === "agreement") {
      return <AgreementPanel onSuccess={onAgreementSuccess} />;
    }
    return null;
  }

  function renderMainFeed() {
    if (centerEntries.length === 0) {
      return (
        <div className="flex min-h-[160px] items-center justify-center border-t border-dashed border-[color:var(--divide-muted)] px-4 py-14 text-center text-sm text-[color:var(--text-muted)]">
          Henüz içerik yok
        </div>
      );
    }
    if (feedEntriesFiltered.length === 0) {
      return (
        <div className="flex min-h-[160px] items-center justify-center border-t border-dashed border-[color:var(--divide-muted)] px-4 py-14 text-center text-sm text-[color:var(--text-muted)]">
          Bu kategoride entry yok.
        </div>
      );
    }
    return (
      <div className="relative z-0 pb-6 md:pb-9">
        <nav
          className="flex flex-col border-t border-[color:var(--divide-muted)]"
          aria-label="Entry akışı"
        >
          {centerFeedEntries.map((entry) => {
            const cc = commentsByEntryIdLive[entry.id]?.length ?? 0;
            const author = entry.authorLabel?.trim() ?? "—";
            const isActive = entry.id === effectiveEntryId;
            return (
              <FeedEntryCard
                key={entry.id}
                title={entry.title}
                contentPreview={entry.content}
                author={author}
                commentCount={cc}
                isActive={isActive}
                onSelect={() => selectEntry(entry.id)}
              />
            );
          })}
        </nav>
        {feedHasMore ? (
          <button
            type="button"
            onClick={() =>
              setFeedVisibleCount((c) => c + FEED_PAGE_SIZE)
            }
            className="mt-8 w-full rounded-[var(--radius-md)] border border-dashed border-[color:var(--divide-muted)] bg-transparent px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--text-muted)] transition-[color,border-color,background-color] duration-200 hover:border-[color:var(--border-subtle)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text-secondary)]"
          >
            Daha fazla yükle
          </button>
        ) : null}
      </div>
    );
  }

  function notificationActorLabel(
    n: (typeof headerNotifications)[number]
  ): string {
    return (
      n.actorDisplayName?.trim() ||
      n.actorMentionHandle?.trim() ||
      "Kullanıcı"
    );
  }

  function renderNotificationsCenter() {
    return (
      <div className="relative z-0 pb-6 md:pb-9">
        <h1 className="m-0 border-0 pb-5 text-[13px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)] md:pb-6">
          Bildirimler
        </h1>
        {notificationsLoading ? (
          <p
            className="py-10 text-center text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Yükleniyor…
          </p>
        ) : notificationsFetchError ? (
          <p
            className="py-10 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Bildirimler yüklenemedi
          </p>
        ) : headerNotifications.length === 0 ? (
          <p
            className="py-10 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Henüz bildirimin yok
          </p>
        ) : (
          <ul className="m-0 list-none border-t border-[color:var(--divide)] p-0">
            {headerNotifications.map((n) => {
              const actor = notificationActorLabel(n);
              const titleLine = n.entryTitle?.trim() ?? "—";
              const canNavigate =
                typeof n.entry_id === "string" && n.entry_id.length > 0;
              const unread = !n.is_read;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    disabled={!canNavigate}
                    onClick={() => {
                      if (!canNavigate || !n.entry_id) return;
                      selectEntry(n.entry_id);
                    }}
                    className="flex w-full flex-col gap-0.5 border-b border-[color:var(--divide)] py-3.5 text-left transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-default disabled:opacity-50 last:border-b-0 md:py-4"
                  >
                    <div className="flex w-full min-w-0 items-baseline justify-between gap-3">
                      <span
                        className="min-w-0 truncate text-[14px] leading-snug text-[color:var(--text-primary)]"
                        style={{
                          fontWeight: unread ? 600 : 500,
                        }}
                      >
                        {actor}
                      </span>
                      <time
                        className="shrink-0 tabular-nums text-[12px] leading-none text-[color:var(--text-muted)]"
                        dateTime={n.created_at}
                      >
                        {formatNotificationTime(n.created_at)}
                      </time>
                    </div>
                    <span
                      className="line-clamp-2 text-[14px] leading-snug text-[color:var(--text-secondary)]"
                      title={titleLine !== "—" ? titleLine : undefined}
                    >
                      {titleLine}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  function renderEntryDetailContent() {
    if (!selectedEntry) {
      return (
        <div
          className="flex min-h-[120px] items-center justify-center px-4 py-10 text-center text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          Entry bulunamadı.
        </div>
      );
    }

    const commentLikeCount = (c: CommentItem) =>
      commentReactionSummaries[c.id]?.likes ?? 0;
    const hasLikes =
      selectedComments.length > 0 &&
      selectedComments.some((c) => commentLikeCount(c) > 0);
    const topLikedComment =
      selectedComments.length === 0
        ? null
        : hasLikes
          ? selectedComments.reduce<CommentItem | null>(
              (max, c) =>
                commentLikeCount(c) >
                (max != null ? commentLikeCount(max) : 0)
                  ? c
                  : max,
              null
            )
          : selectedComments[0];

    const entryAuthor =
      selectedEntry.authorLabel?.trim() || "—";
    const entryMetaLine = `${entryAuthor} · ${formatDate(selectedEntry.created_at)}`;

    return (
      <div className="relative z-0 max-w-none">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <button
            type="button"
            onClick={() => closeEntryModal()}
            className="inline-flex w-fit border-0 bg-transparent p-0 text-[12px] font-normal tracking-[0.02em] text-[color:var(--text-muted)] underline decoration-[color:var(--divide-muted)] underline-offset-[5px] transition-colors hover:text-[color:var(--text-secondary)] hover:decoration-[color:var(--divide)]"
          >
            ← akışa dön
          </button>
        </div>

        <article className="mt-8 md:mt-10">
          <header className="m-0 border-0 p-0">
            <h1
              id="entry-detail-title"
              className="m-0 text-[clamp(1.625rem,3.2vw,2rem)] font-semibold leading-[1.2] tracking-[-0.026em] text-[color:var(--text-primary)] md:leading-[1.18] md:tracking-[-0.024em]"
              style={{
                fontFamily: "var(--font-editorial-display)",
                fontWeight: 600,
                textRendering: "optimizeLegibility",
              }}
            >
              {selectedEntry.title}
            </h1>
            <p className="mt-4 text-[12px] font-normal leading-relaxed tracking-[0.04em] text-[color:var(--text-muted)] md:mt-5">
              {entryMetaLine}
            </p>
          </header>
          <section
            aria-labelledby="entry-detail-title"
            className="m-0 mt-7 border-0 p-0 md:mt-8"
          >
            <p className="m-0 text-[17px] font-normal leading-[1.75] text-[color:var(--text-secondary)] md:text-[18px] md:leading-[1.72]">
              {selectedEntry.content}
            </p>
          </section>
          <div
            className="mt-8 h-px w-full bg-[color:var(--divide-hair)] md:mt-10"
            aria-hidden
          />
        </article>

        {(() => {
          const s = entryReactionSummaries[selectedEntry.id] ?? {
            likes: 0,
            dislikes: 0,
            mine: null,
          };
          const metaBtn: CSSProperties = {
            border: "none",
            background: "transparent",
            padding: 0,
            margin: 0,
            cursor: "pointer",
            font: "inherit",
            fontSize: "12px",
            fontWeight: 500,
            letterSpacing: "0.01em",
            transition: "var(--transition)",
          };
          const metaMuted: CSSProperties = {
            ...metaBtn,
            fontWeight: 400,
            color: "var(--text-muted)",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
            textDecorationColor: "var(--divide-muted)",
          };
          const dot = (
            <span
              className="mx-2 inline-block translate-y-[-0.04em] text-[0.55rem] text-[color:var(--divide-muted)]"
              aria-hidden
            >
              ·
            </span>
          );
          return (
            <div className="mt-5 flex flex-wrap items-baseline gap-y-2 pb-1 md:mt-6 md:pb-0">
              <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
                <button
                  type="button"
                  style={{
                    ...metaBtn,
                    color:
                      s.mine === "like"
                        ? "var(--accent-green)"
                        : "var(--text-secondary)",
                  }}
                  className="hover:text-[color:var(--accent-green)]"
                  onClick={() =>
                    void toggleEntryReaction(selectedEntry.id, "like")
                  }
                >
                  Beğendim
                </button>
                <button
                  type="button"
                  className="tabular-nums text-[12px] font-medium text-[color:var(--text-tertiary)] transition-colors hover:text-[color:var(--text-secondary)]"
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    cursor: "pointer",
                    font: "inherit",
                  }}
                  onClick={() =>
                    setReactionsModal({
                      open: true,
                      type: "entry",
                      id: selectedEntry.id,
                      tab: "like",
                    })
                  }
                >
                  {s.likes}
                </button>
              </span>
              {dot}
              <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
                <button
                  type="button"
                  style={{
                    ...metaBtn,
                    color:
                      s.mine === "dislike"
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                  }}
                  className="hover:text-[color:var(--text-primary)]"
                  onClick={() =>
                    void toggleEntryReaction(selectedEntry.id, "dislike")
                  }
                >
                  Beğenmedim
                </button>
                <button
                  type="button"
                  className="tabular-nums text-[12px] font-medium text-[color:var(--text-tertiary)] transition-colors hover:text-[color:var(--text-secondary)]"
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    cursor: "pointer",
                    font: "inherit",
                  }}
                  onClick={() =>
                    setReactionsModal({
                      open: true,
                      type: "entry",
                      id: selectedEntry.id,
                      tab: "dislike",
                    })
                  }
                >
                  {s.dislikes}
                </button>
              </span>
              {dot}
              <button
                type="button"
                style={metaMuted}
                className="hover:text-[color:var(--text-secondary)]"
                onClick={() =>
                  copyEntryLink(selectedEntry.id, selectedEntry.title)
                }
              >
                kopyala
              </button>
              {dot}
              <button
                type="button"
                style={metaMuted}
                className="hover:text-[color:var(--text-secondary)]"
                onClick={() =>
                  shareWhatsApp(selectedEntry.id, selectedEntry.title)
                }
              >
                whatsapp
              </button>
              {dot}
              <button
                type="button"
                style={metaMuted}
                className="hover:text-[color:var(--text-secondary)]"
                onClick={() => shareX(selectedEntry.id, selectedEntry.title)}
              >
                x
              </button>
            </div>
          );
        })()}

        <section
          className="mt-6 border-t border-[color:var(--divide-hair)] pt-6 md:mt-7 md:pt-7"
          aria-label="Katkılar"
        >
          <h3
            className="m-0 text-[13px] font-medium leading-snug tracking-[-0.018em] text-[color:var(--text-primary)] md:text-[14px] md:tracking-[-0.02em]"
            style={{
              fontFamily: "var(--font-editorial-display)",
              fontWeight: 500,
              textRendering: "optimizeLegibility",
            }}
          >
            Katkılar
          </h3>
          <div
            className="pointer-events-none mt-4 h-px w-full max-w-[4rem] bg-gradient-to-r from-[color:var(--divide-muted)] to-transparent opacity-80 md:mt-5"
            aria-hidden
          />

          {selectedComments.length === 0 ? (
            <div className="mt-6 py-8 text-center text-[13px] leading-relaxed text-[color:var(--text-muted)] md:mt-7 md:py-9">
              ilk yorumu sen yaz
            </div>
          ) : (
            <div className="mt-5 flex flex-col md:mt-6">
              {selectedComments.map((comment, index) => {
                const cs = commentReactionSummaries[comment.id] ?? {
                  likes: 0,
                  dislikes: 0,
                  mine: null,
                };
                const isTop = comment.id === topLikedComment?.id;
                const flowPadTop =
                  index === 0
                    ? "pt-0"
                    : index === 1
                      ? "pt-10 md:pt-12"
                      : "pt-7 md:pt-8";
                const textAction: CSSProperties = {
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  margin: 0,
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: "11px",
                  fontWeight: 400,
                  letterSpacing: "0.03em",
                  transition: "var(--transition)",
                };
                const cDot = (
                  <span
                    className="mx-2 inline-block translate-y-[-0.04em] text-[0.45rem] font-light text-[color:var(--divide-muted)]"
                    aria-hidden
                  >
                    ·
                  </span>
                );
                return (
                  <div
                    key={comment.id}
                    className={`min-w-0 w-full border-b border-[color:var(--divide-hair)] pb-7 last:border-b-0 md:pb-8 ${flowPadTop}`}
                  >
                    <p className="m-0 text-[15px] font-semibold leading-snug text-[color:var(--text-primary)]">
                      {comment.authorLabel}
                    </p>
                    {comment.bio61?.trim() ? (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[color:var(--text-muted)]">
                        {comment.bio61.trim()}
                      </p>
                    ) : null}
                    <p className="m-0 mt-3 text-[15px] font-normal leading-[1.68] text-[color:var(--text-secondary)] md:mt-3.5">
                      {comment.content}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-none text-[color:var(--text-muted)]">
                      {isTop ? (
                        <span className="text-[7px] font-normal uppercase tracking-[0.22em] text-[color:var(--accent-green)] opacity-[0.78]">
                          Öne çıkan
                        </span>
                      ) : null}
                      {isTop ? (
                        <span
                          className="text-[color:var(--divide-muted)]"
                          aria-hidden
                        >
                          ·
                        </span>
                      ) : null}
                      <time
                        className="tabular-nums font-normal opacity-90"
                        dateTime={comment.created_at}
                      >
                        {formatDate(comment.created_at)}
                      </time>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-baseline text-[11px] font-normal md:mt-3">
                      <button
                        type="button"
                        style={{
                          ...textAction,
                          color:
                            cs.mine === "like"
                              ? "var(--accent-green)"
                              : "var(--text-muted)",
                          textDecoration: "none",
                        }}
                        className="decoration-[color:var(--divide-muted)] underline-offset-[3px] hover:text-[color:var(--text-secondary)] hover:underline"
                        onClick={() =>
                          void toggleCommentReaction(comment.id, "like")
                        }
                      >
                        Beğendim
                      </button>
                      <button
                        type="button"
                        className="tabular-nums text-[color:var(--text-tertiary)] decoration-[color:var(--divide-muted)] underline-offset-[3px] hover:text-[color:var(--text-secondary)] hover:underline"
                        style={{
                          ...textAction,
                          marginLeft: "3px",
                          textDecoration: "none",
                        }}
                        onClick={() =>
                          setReactionsModal({
                            open: true,
                            type: "comment",
                            id: comment.id,
                            tab: "like",
                          })
                        }
                      >
                        {cs.likes}
                      </button>
                      {cDot}
                      <button
                        type="button"
                        style={{
                          ...textAction,
                          color:
                            cs.mine === "dislike"
                              ? "var(--text-primary)"
                              : "var(--text-muted)",
                          textDecoration: "none",
                        }}
                        className="decoration-[color:var(--divide-muted)] underline-offset-[3px] hover:text-[color:var(--text-secondary)] hover:underline"
                        onClick={() =>
                          void toggleCommentReaction(comment.id, "dislike")
                        }
                      >
                        Beğenmedim
                      </button>
                      <button
                        type="button"
                        className="tabular-nums text-[color:var(--text-tertiary)] decoration-[color:var(--divide-muted)] underline-offset-[3px] hover:text-[color:var(--text-secondary)] hover:underline"
                        style={{
                          ...textAction,
                          marginLeft: "3px",
                          textDecoration: "none",
                        }}
                        onClick={() =>
                          setReactionsModal({
                            open: true,
                            type: "comment",
                            id: comment.id,
                            tab: "dislike",
                          })
                        }
                      >
                        {cs.dislikes}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-8 border-t border-[color:var(--divide-hair)] pt-6 md:mt-10 md:pt-7">
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
            Katkı ekle
          </p>
          <div
            className="rounded-[var(--radius-md)] border border-[color:var(--border-subtle)] bg-[var(--surface-hover)] px-3 py-3 md:px-4 md:py-3.5"
            style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.04)" }}
          >
            <textarea
              ref={commentComposeTextareaRef}
              placeholder="sen ne düşünüyorsun? (@ile etiket)"
              maxLength={161}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value.slice(0, 161))}
              onFocus={() => {
                setCommentComposeFocused(true);
                void requireAuthForComment();
              }}
              onBlur={() => setCommentComposeFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submitComment();
                }
              }}
              className="w-full resize-none border-0 bg-transparent placeholder:text-[color:var(--text-muted)] placeholder:opacity-90 focus:outline-none focus:ring-0"
              style={{
                width: "100%",
                resize: "none",
                minHeight: "56px",
                padding: "4px 2px 8px",
                margin: 0,
                border: "none",
                borderBottom: "1px solid",
                borderColor: commentComposeFocused
                  ? "var(--accent-green-line)"
                  : "var(--divide-muted)",
                borderRadius: 0,
                outline: "none",
                color: "var(--text-primary)",
                fontSize: "15px",
                lineHeight: "1.65",
                transition: "var(--transition)",
              }}
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSubmittingComment}
                onClick={() => void submitComment()}
                className="border-0 bg-transparent p-0 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--text-tertiary)] underline decoration-[color:var(--divide-muted)] underline-offset-[5px] transition-colors duration-150 hover:text-[color:var(--accent-green)] hover:decoration-[color:var(--accent-green-line)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                gönder
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-[100rem] flex-col bg-transparent px-4 text-[color:var(--text-primary)] antialiased md:px-12 lg:px-14">
      <header className="relative mb-6 shrink-0 border-b border-[color:var(--divide-muted)] pt-6 pb-5 md:mb-8 md:pt-8 md:pb-6">
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end md:gap-10">
          <div className="hidden md:block" aria-hidden />
          <div className="text-center md:col-start-2 md:pb-0">
            <button
              type="button"
              onClick={goToBrandHome}
              className="border-0 bg-transparent p-0 text-[26px] font-semibold leading-[1.05] tracking-[-0.055em] text-[color:var(--text-primary)] transition-[color,opacity] duration-200 hover:opacity-90 md:text-[30px]"
              style={{ fontFeatureSettings: '"ss01" 1, "cv01" 1' }}
              aria-label="Ana sayfa — Akış"
            >
              61larus
            </button>
            <p className="mx-auto mt-3 max-w-sm text-[11px] font-normal leading-relaxed tracking-[0.12em] text-[color:var(--text-muted)] md:mt-3.5 md:max-w-md md:text-[12px] md:tracking-[0.1em]">
              Trabzon’un gündemi, lafı ve hafızası
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-center gap-3 md:col-start-3 md:w-auto md:justify-end md:gap-4">
            {isAuthenticated ? (
              <>
                <div className="relative" ref={notificationsMenuRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setNotificationsOpen((open) => {
                        const next = !open;
                        if (next) void fetchHeaderNotifications();
                        return next;
                      });
                    }}
                    className="relative border-0 bg-transparent p-0"
                    aria-expanded={notificationsOpen}
                    aria-haspopup="true"
                    aria-label="Bildirimler"
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 2px",
                        cursor: "pointer",
                        transition: "var(--transition)",
                      }}
                      className="text-[12px] text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]"
                    >
                      <span
                        style={{
                          fontSize: "14px",
                          lineHeight: 1,
                          color: "var(--text-secondary)",
                        }}
                        aria-hidden
                      >
                        {"\uD83D\uDD14"}
                      </span>
                      <span className="font-medium">bildirim</span>
                      {unreadNotificationCount > 0 ? (
                        <span
                          className="tabular-nums"
                          style={{
                            minWidth: "1.1rem",
                            padding: "0 5px",
                            borderRadius: "999px",
                            fontSize: "10px",
                            fontWeight: 700,
                            lineHeight: "18px",
                            textAlign: "center",
                            background: "rgba(255,255,255,0.1)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {unreadNotificationCount > 9
                            ? "9+"
                            : unreadNotificationCount}
                        </span>
                      ) : null}
                    </div>
                  </button>
                  {notificationsOpen ? (
                    <div
                      className="absolute right-0 z-[60] mt-2 max-h-[min(420px,70dvh)] w-[min(calc(100vw-1.5rem),400px)] overflow-y-auto border border-[color:var(--divide)] bg-[var(--bg-secondary)] py-3 pl-4 pr-3"
                      role="list"
                    >
                      {notificationsLoading ? (
                        <p
                          className="py-6 text-center text-sm"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Yükleniyor…
                        </p>
                      ) : notificationsFetchError ? (
                        <p
                          className="py-6 text-center text-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Bildirimler yüklenemedi
                        </p>
                      ) : (
                        <>
                          {headerNotifications.length === 0 ? (
                            <p
                              className="py-5 text-center text-sm"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Henüz bildirimin yok
                            </p>
                          ) : (
                            <ul className="m-0 list-none border-t border-[color:var(--divide)] p-0">
                              {headerNotifications.slice(0, 3).map((n) => {
                                const actor = notificationActorLabel(n);
                                const titleLine = n.entryTitle?.trim() ?? "—";
                                const canNavigate =
                                  typeof n.entry_id === "string" &&
                                  n.entry_id.length > 0;
                                const unread = !n.is_read;
                                return (
                                  <li key={n.id}>
                                    <button
                                      type="button"
                                      disabled={!canNavigate}
                                      onClick={() => {
                                        if (!canNavigate || !n.entry_id) return;
                                        setNotificationsOpen(false);
                                        selectEntry(n.entry_id);
                                      }}
                                      className="flex w-full flex-col gap-0.5 border-b border-[color:var(--divide)] py-3 text-left transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-default disabled:opacity-50 last:border-b-0"
                                    >
                                      <div className="flex w-full min-w-0 items-baseline justify-between gap-3">
                                        <span
                                          className="min-w-0 truncate text-[14px] leading-snug text-[color:var(--text-primary)]"
                                          style={{
                                            fontWeight: unread ? 600 : 500,
                                          }}
                                        >
                                          {actor}
                                        </span>
                                        <time
                                          className="shrink-0 tabular-nums text-[11px] leading-none text-[color:var(--text-muted)]"
                                          dateTime={n.created_at}
                                        >
                                          {formatNotificationTime(n.created_at)}
                                        </time>
                                      </div>
                                      <span
                                        className="line-clamp-2 text-[13px] leading-snug text-[color:var(--text-secondary)]"
                                        title={titleLine !== "—" ? titleLine : undefined}
                                      >
                                        {titleLine}
                                      </span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          <button
                            type="button"
                            className="mt-2 w-full border-0 border-t border-[color:var(--divide)] bg-transparent pt-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--text-secondary)]"
                            onClick={() => {
                              setNotificationsOpen(false);
                              setCenterMode("notifications");
                            }}
                          >
                            Tüm bildirimler
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(false);
                    setAccountMenuOpen((o) => !o);
                  }}
                  className="max-w-full border-0 bg-transparent p-0"
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                >
                  <div
                    className="flex cursor-pointer items-center gap-1.5 px-1 py-0.5 text-[12px] text-[color:var(--text-muted)] transition-colors duration-150 hover:text-[color:var(--text-secondary)]"
                    style={{ transition: "var(--transition)" }}
                  >
                    <span className="font-normal opacity-70">sen</span>
                    <span className="font-medium text-[color:var(--text-primary)]">
                      {userEmail?.split("@")[0] || "kullanıcı"}
                    </span>
                  </div>
                </button>
                {accountMenuOpen ? (
                  <div
                    className="absolute right-0 z-50 mt-1.5 w-[min(calc(100vw-1.5rem),14.5rem)] rounded-lg border border-white/[0.1] bg-[#161920] py-2.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.65)]"
                    role="menu"
                  >
                    <p className="px-3 pb-2 text-[10px] font-normal leading-snug text-[#6b7280]">
                      Google ile giriş yapıldı
                    </p>
                    <div className="mx-2 mb-2 border-b border-white/[0.06]" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handleLogout()}
                      className="flex w-full items-center px-3 py-2 text-left text-xs font-medium text-[#e7e9ee] transition-colors hover:bg-white/[0.06]"
                    >
                      Çıkış yap
                    </button>
                    {accountDeleteStep === "idle" ? (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={accountDeleteLoading}
                        onClick={() => setAccountDeleteStep("confirm")}
                        className="flex w-full items-center px-3 py-2 text-left text-xs font-medium text-[#c45c5c] transition-colors hover:bg-red-500/10 disabled:opacity-40"
                      >
                        Hesabımı sil
                      </button>
                    ) : (
                      <div className="space-y-2 px-3 pb-0.5 pt-1">
                        <p className="text-[10px] font-normal leading-snug text-[#8b929e]">
                          Bu işlem geri alınamaz. Profil bilgilerin kaldırılır; eski
                          içerikler anonim görünür.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={accountDeleteLoading}
                            onClick={() => void handleConfirmAccountDeletion()}
                            className="inline-flex h-8 flex-1 items-center justify-center rounded-md border border-red-500/35 bg-red-500/10 px-2.5 text-[11px] font-medium text-[#f0a0a0] transition-colors hover:bg-red-500/15 disabled:opacity-40"
                          >
                            {accountDeleteLoading ? "İşleniyor…" : "Silmeyi onayla"}
                          </button>
                          <button
                            type="button"
                            disabled={accountDeleteLoading}
                            onClick={() => setAccountDeleteStep("idle")}
                            className="inline-flex h-8 items-center justify-center px-2 text-[11px] font-normal text-[#8b929e] underline decoration-white/20 underline-offset-2 transition-colors hover:text-[#a8c4aa] disabled:opacity-40"
                          >
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    )}
                    {accountDeleteError ? (
                      <p className="px-3 pt-2 text-[10px] leading-snug text-red-400/95">
                        {accountDeleteError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <section
        className={
          centerMode === "auth" || centerMode === "agreement"
            ? "relative z-0 flex w-full flex-col"
            : "relative z-0 flex w-full flex-col border-y border-[color:var(--divide-muted)] bg-[var(--surface-page)]"
        }
      >
        {centerMode === "auth" || centerMode === "agreement" ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "80px",
            }}
          >
            {renderCenterPanels()}
          </div>
        ) : (
          <div className="flex w-full min-w-0 flex-col gap-0 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)_minmax(0,1fr)] md:items-start md:gap-0">
            <aside
              className="flex max-h-[32vh] w-full min-w-0 shrink-0 flex-col overflow-hidden border-b border-[color:var(--divide-muted)] bg-[var(--surface-panel)] md:sticky md:top-4 md:z-[5] md:max-h-[calc(100dvh-6rem)] md:w-full md:max-w-none md:overflow-hidden md:self-start md:border-b-0 md:border-r md:border-[color:var(--divide-muted)]"
              aria-label="Gündem — en çok konuşulanlar"
            >
              <div className="shrink-0 border-b border-[color:var(--divide-muted)] px-4 pb-4 pt-5 md:px-5 md:pb-5 md:pt-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-secondary)]">
                  Gündem
                </p>
                <p className="mt-2 text-[12px] font-normal leading-relaxed text-[color:var(--text-muted)]">
                  Şu an en çok konuşulanlar
                </p>
              </div>
              <div
                className="left-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "rgba(255,255,255,0.16) transparent",
                }}
              >
                <nav
                  className="flex flex-col px-3 pb-6 pt-2 md:px-4"
                  aria-label="En çok yorumlananlar"
                >
                  {mostCommentedEntries.map((entry, index) => {
                    const cc = commentsByEntryIdLive[entry.id]?.length ?? 0;
                    const isActive = entry.id === effectiveEntryId;
                    const rank = index + 1;
                    const isFirst = index === 0;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => selectEntry(entry.id)}
                        style={{
                          transition: "var(--transition)",
                          boxShadow: isActive
                            ? "inset 2px 0 0 0 var(--accent-green-line)"
                            : undefined,
                        }}
                        className={`group relative flex w-full items-start gap-3 border-0 border-b border-[color:var(--divide-muted)] py-3.5 pl-1.5 pr-1.5 text-left last:border-b-0 md:py-4 ${
                          isActive
                            ? "bg-[var(--list-row-active)]"
                            : "bg-transparent hover:bg-[var(--surface-hover)]"
                        }`}
                      >
                        <span
                          className={`w-5 shrink-0 pt-0.5 text-right text-[10px] font-medium tabular-nums leading-none tracking-wide ${
                            isActive
                              ? "text-[color:var(--accent-green)]"
                              : "text-[color:var(--text-muted)] group-hover:text-[color:var(--text-tertiary)]"
                          }`}
                          aria-hidden
                        >
                          {rank}.
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span
                            className={`line-clamp-2 text-[13px] leading-[1.45] text-[color:var(--text-primary)] ${
                              isFirst || isActive
                                ? "font-semibold"
                                : "font-normal"
                            }`}
                          >
                            {entry.title}
                          </span>
                          <span className="text-[10px] font-normal tabular-nums uppercase tracking-[0.06em] text-[color:var(--text-muted)]">
                            {cc} yorum
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </aside>
            <main className="relative min-w-0 w-full bg-[var(--surface-page)] md:border-x md:border-[color:var(--divide-muted)] md:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
              <div className="layout-feed-inner mx-auto w-full max-w-[48rem] px-5 py-7 md:px-14 md:py-9">
                {centerMode === "notifications"
                  ? renderNotificationsCenter()
                  : renderMainFeed()}
              </div>
            </main>
            <aside
              className="flex max-h-[36vh] w-full min-w-0 shrink-0 flex-col overflow-hidden border-t border-[color:var(--divide-muted)] bg-[var(--surface-panel)] md:sticky md:top-4 md:z-[5] md:max-h-[calc(100dvh-6rem)] md:w-full md:max-w-none md:overflow-hidden md:self-start md:border-l md:border-t-0 md:border-[color:var(--divide-muted)]"
              aria-label="Kategoriler"
            >
              <div className="shrink-0 border-b border-[color:var(--divide-muted)] px-4 pb-4 pt-5 md:px-5 md:pb-5 md:pt-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-secondary)]">
                  Kategoriler
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-5 pt-3 md:px-4 md:pb-6">
                <nav
                  className="flex flex-col gap-0.5"
                  aria-label="Entry kategorileri"
                >
                  {FEED_CATEGORY_OPTIONS.map((opt) => {
                    const isActive = feedCategoryFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFeedCategoryFilter(opt.id)}
                        style={{ transition: "var(--transition)" }}
                        className={`group flex w-full cursor-pointer rounded-[var(--radius-sm)] border border-transparent py-2.5 pl-2.5 pr-2 text-left text-[13px] leading-snug ${
                          isActive
                            ? "border-[color:var(--border-subtle)] bg-[var(--list-row-active)] font-medium text-[color:var(--text-primary)] shadow-[inset_2px_0_0_0_var(--accent-green-line)]"
                            : "font-normal text-[color:var(--text-muted)] hover:border-[color:var(--border-subtle)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text-secondary)]"
                        }`}
                      >
                        <span
                          className="mr-2 flex h-4 w-3 shrink-0 items-center justify-center"
                          aria-hidden
                        >
                          <span
                            className={`block h-1.5 w-1.5 rounded-full transition-[background-color,opacity,transform] duration-200 ${
                              isActive
                                ? "bg-[color:var(--accent-green)] opacity-90"
                                : "scale-75 bg-[color:var(--divide)] opacity-0 group-hover:opacity-35"
                            }`}
                          />
                        </span>
                        <span className="min-w-0">{opt.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </aside>
          </div>
        )}
      </section>

      {selectedEntryId && centerMode === "feed" ? (
        <div
          className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/45 px-3 py-5 backdrop-blur-[1px] md:items-center md:py-8"
          role="presentation"
          onClick={() => closeEntryModal()}
        >
          <div
            className="my-auto w-full max-w-[48rem] border border-[color:var(--divide)] bg-[var(--bg-secondary)] shadow-[var(--shadow-modal)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="left-scroll max-h-[min(92dvh,900px)] overflow-y-auto overscroll-contain">
              <div className="px-5 py-6 md:px-9 md:py-8">
                {renderEntryDetailContent()}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {reactionsModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
          <div
            className="max-h-[500px] w-[min(calc(100vw-2rem),400px)] overflow-y-auto border border-[color:var(--divide)] bg-[var(--bg-secondary)] p-5 text-[color:var(--text-primary)] shadow-[var(--shadow-modal)] md:p-6"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex justify-between gap-2 border-b border-[color:var(--divide)] pb-4">
              <button
                type="button"
                className="text-sm font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
                onClick={() =>
                  setReactionsModal({ ...reactionsModal, tab: "like" })
                }
              >
                Beğenenler
              </button>
              <button
                type="button"
                className="text-sm font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
                onClick={() =>
                  setReactionsModal({ ...reactionsModal, tab: "dislike" })
                }
              >
                Beğenmeyenler
              </button>
            </div>

            <div id="modal-users">
              {reactionsModalLoading ? (
                <p className="text-sm text-[color:var(--text-muted)]">
                  yükleniyor...
                </p>
              ) : reactionsModalUsers.length === 0 ? (
                <p className="text-sm text-[color:var(--text-muted)]">
                  Henüz kimse yok
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {reactionsModalUsers.map((u) => (
                    <li
                      key={u.userId}
                      className="flex items-center gap-2 text-sm"
                    >
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-full object-cover"
                          width={32}
                          height={32}
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1e293b] text-xs">
                          {u.label.trim().charAt(0).toUpperCase() || "?"}
                        </div>
                      )}
                      <span className="truncate">{u.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              className="mt-5 text-sm font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
              onClick={() =>
                setReactionsModal({ ...reactionsModal, open: false })
              }
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
