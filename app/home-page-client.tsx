"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthPanel from "@/components/auth-panel";
import AgreementPanel from "@/components/agreement-panel";
import { anonymizeCurrentUserAccount } from "@/lib/anonymize-account";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { resolveVisibleName } from "@/lib/visible-name";
import { normalizeEntryCategory } from "@/lib/entry-category";
import { normalizeAdminEntryPublishSection } from "@/lib/admin-entry-publish-section";
import { normalizeEntrySlug } from "@/lib/slug";
import { slugifyEntryTitle } from "@/lib/entry-slug";

const STARTER_ENCYCLOPEDIA_CATEGORY_IDS = new Set<string>([
  "tarih",
  "sahsiyetler",
  "cografya",
  "mahalleler",
]);

function isStarterEncyclopediaEntry(entry: EntryItem): boolean {
  const n = normalizeEntryCategory(entry.category);
  return n != null && STARTER_ENCYCLOPEDIA_CATEGORY_IDS.has(n);
}

/** Admin yayın alanı slug’ı; yoksa legacy (eski kategori) kayıt. */
function entryPublishSlug(entry: EntryItem) {
  return normalizeAdminEntryPublishSection(entry.category);
}

function hasAdminPublishSection(entry: EntryItem): boolean {
  return Boolean(normalizeAdminEntryPublishSection(entry.category));
}

import { FeedEntryCard } from "./feed-entry-card";

function entryMatchesSearch(entry: EntryItem, rawQuery: string): boolean {
  const q = rawQuery.trim();
  if (!q) return true;
  const ql = q.toLocaleLowerCase("tr-TR");
  const parts: string[] = [
    entry.title ?? "",
    entry.content ?? "",
    entry.authorName ?? "",
  ];
  return parts.some((s) => s.toLocaleLowerCase("tr-TR").includes(ql));
}

const LS_PENDING_ENTRY = "pendingEntryId";
const LS_PENDING_ACTION = "pendingAction";

/** Center feed pagination (initial + each “Daha fazla yükle” batch). */
const FEED_PAGE_SIZE = 12;

/** Header orta alan — tek satır, yavaş dönen Atatürk sözleri. */
const HEADER_ATATURK_QUOTES = [
  "Ne mutlu Türküm diyene!",
  "Yurtta sulh, cihanda sulh.",
  "Hayatta en hakiki mürşit ilimdir.",
  "Ümitsiz durumlar yoktur.",
  "İstikbal göklerdedir.",
] as const;

/** 8-4-4-4-12 hex id shape (matches Postgres uuid text form, including v4/v7 and non-RFC variants). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRealUuid(value: string) {
  return UUID_RE.test(value);
}

/** OAuth / PKCE redirect artıkları — entry derin bağlantısı değil. */
function isOAuthReturnQuery(sp: { get: (key: string) => string | null }): boolean {
  const code = sp.get("code");
  const state = sp.get("state");
  return (
    (typeof code === "string" && code.length > 0) ||
    (typeof state === "string" && state.length > 0)
  );
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

export type EntryItem = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  /** SEO path segment when set (public.entries.slug) */
  slug?: string | null;
  category?: string | null;
  authorName?: string | null;
  bio61?: string | null;
};

function entryHrefPath(entry: EntryItem | undefined, id: string): string {
  const fromDb = entry?.slug?.trim();
  if (fromDb) return fromDb;
  const title = entry?.title ?? "";
  return (
    normalizeEntrySlug(title.trim()) || slugifyEntryTitle(title, id)
  );
}

function compareEntriesByNewest(a: EntryItem, b: EntryItem): number {
  const ta = new Date(a.created_at).getTime();
  const tb = new Date(b.created_at).getTime();
  if (tb !== ta) return tb - ta;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export type CommentItem = {
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

export type CenterMode = "feed" | "entry" | "auth" | "agreement";

type FooterInfoId = "about" | "rules" | "privacy" | "contact";

export type HomePageClientProps = {
  leftEntries: EntryItem[];
  centerEntries: EntryItem[];
  rightEntries: EntryItem[];
  commentsByEntryId: Record<string, CommentItem[]>;
  isAuthenticated: boolean;
  /** Oturum kimliği değişince sözleşme state’i sunucu ile yeniden hizalanır (çıkış→giriş). */
  authUserId: string | null;
  initialAgreementDone: boolean;
  initialOnboardingDone: boolean;
  /** Yönetici askıdayken yorum/etkileşim kapatılır; salt okuma kalır. */
  initialPlatformAccessSuspended: boolean;
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

type Props = HomePageClientProps;

/** Kısa tarih: meta satır (ör. 12 Oca 2025) */
function formatFeedLineDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Yalnızca public.users satırı; RSC / stale prop fallback yok. */
function platformSuspendedFromUsersRow(
  row: { is_platform_access_suspended?: unknown } | null
): boolean {
  if (!row) return false;
  return row.is_platform_access_suspended === true;
}

export default function HomePageClient({
  leftEntries,
  centerEntries,
  rightEntries,
  commentsByEntryId,
  isAuthenticated,
  authUserId,
  initialAgreementDone,
  initialOnboardingDone,
  initialPlatformAccessSuspended,
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
  const routerRef = useRef(router);
  routerRef.current = router;
  const searchParams = useSearchParams();
  const entriesByIdRef = useRef<EntryItem[]>([]);
  entriesByIdRef.current = [
    ...centerEntries,
    ...leftEntries,
    ...rightEntries,
  ];

  const [centerMode, setCenterMode] = useState<CenterMode>("feed");
  const [feedVisibleCount, setFeedVisibleCount] = useState(FEED_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [headerEditorialIdx, setHeaderEditorialIdx] = useState(0);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [accountDeleteStep, setAccountDeleteStep] = useState<"idle" | "confirm">(
    "idle"
  );
  const [accountDeleteLoading, setAccountDeleteLoading] = useState(false);
  const [accountDeleteError, setAccountDeleteError] = useState<string | null>(
    null
  );
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [footerInfoOpen, setFooterInfoOpen] = useState<FooterInfoId | null>(
    null
  );

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

  const [agreementDone, setAgreementDone] = useState(initialAgreementDone);
  const [onboardingDone, setOnboardingDone] = useState(initialOnboardingDone);
  /**
   * public.users’tan doğrulanmış askı: yalnızca `true` iken UI kilitli.
   * `null` = henüz bu oturum için sonuç yok (stale RSC prop’a asla düşme).
   */
  const [suspendFromUsers, setSuspendFromUsers] = useState<boolean | null>(null);
  const initialSuspendRef = useRef(initialPlatformAccessSuspended);
  initialSuspendRef.current = initialPlatformAccessSuspended;
  const platformAccessSuspended = suspendFromUsers === true;

  const agreementDoneRef = useRef(agreementDone);
  const onboardingDoneRef = useRef(onboardingDone);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const platformAccessSuspendedRef = useRef(platformAccessSuspended);
  /**
   * Oturum kimliği (çıkış / tekrar giriş) değişiminde, eski "agreement true" client
   * değerinin sunucu false ile asla birleşmemesini sağlamak için.
   */
  const lastAuthUserIdForGateRef = useRef<string | null | "unset">("unset");
  /** Until RSC shows a signed-out user, skip agreement routing + prop merge that can fight logout/delete. */
  const postSignOutHardResetRef = useRef(false);
  agreementDoneRef.current = agreementDone;
  onboardingDoneRef.current = onboardingDone;
  isAuthenticatedRef.current = isAuthenticated;
  platformAccessSuspendedRef.current = platformAccessSuspended;

  useEffect(() => {
    if (!isAuthenticated) {
      postSignOutHardResetRef.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const currentId: string | null =
      isAuthenticated && authUserId ? authUserId : null;

    if (lastAuthUserIdForGateRef.current === "unset") {
      lastAuthUserIdForGateRef.current = currentId;
    } else if (lastAuthUserIdForGateRef.current !== currentId) {
      lastAuthUserIdForGateRef.current = currentId;
      if (currentId) {
        setAgreementDone(initialAgreementDone);
        setOnboardingDone(initialOnboardingDone);
        agreementDoneRef.current = initialAgreementDone;
        onboardingDoneRef.current = initialOnboardingDone;
      } else {
        setAgreementDone(false);
        setOnboardingDone(false);
        agreementDoneRef.current = false;
        onboardingDoneRef.current = false;
      }
      return;
    }

    if (postSignOutHardResetRef.current) {
      setAgreementDone(false);
      setOnboardingDone(false);
      return;
    }
    // Aynı oturumda: RSC henüz yenilenmeden sözleşme onayını koru (|| prev). Kimlik
    // değişiminde yukarıda zaten server değerine sert hizalama yapıldı.
    setAgreementDone((prev) =>
      isAuthenticated ? initialAgreementDone || prev : initialAgreementDone
    );
    setOnboardingDone((prev) =>
      isAuthenticated ? initialOnboardingDone || prev : initialOnboardingDone
    );
  }, [
    authUserId,
    isAuthenticated,
    initialAgreementDone,
    initialOnboardingDone,
  ]);

  /** public.users `is_platform_access_suspended` — tek kaynak; `router` deps’te yok (refresh sonsuz tetiklemez). */
  useEffect(() => {
    if (!isAuthenticated || !authUserId) {
      setSuspendFromUsers(null);
      return;
    }

    let cancelled = false;

    const verifySuspendFromUsers = async (clearPendingUntilResult: boolean) => {
      if (clearPendingUntilResult) {
        setSuspendFromUsers(null);
      }
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("users")
        .select("id, is_platform_access_suspended")
        .eq("id", authUserId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.warn("[home] platform suspend refresh failed", error);
        return;
      }

      const fetchedSuspendedValue = data?.is_platform_access_suspended;
      const effectiveSuspendedValue = platformSuspendedFromUsersRow(
        data as { is_platform_access_suspended?: unknown } | null
      );
      const pendingValue = initialSuspendRef.current;

      console.log("home suspend debug", {
        authUserId,
        fetchedSuspendedValue,
        pendingValue,
        effectiveSuspendedValue,
      });

      setSuspendFromUsers(effectiveSuspendedValue);
      void routerRef.current.refresh();
    };

    void verifySuspendFromUsers(true);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void verifySuspendFromUsers(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isAuthenticated, authUserId]);

  const goToEntry = useCallback((id: string) => {
    writePendingReturn(id, "comment");
    const item = entriesByIdRef.current.find((e) => e.id === id);
    const path = entryHrefPath(item, id);
    void routerRef.current.push(`/${encodeURI(path)}`);
  }, []);

  /** Tam yazı akışı: arama kapalı, ana sayfaya dön. */
  const resetToWritingsFeed = useCallback(() => {
    setSearchQuery("");
    void router.push("/");
  }, [router]);

  /** Wordmark: kimlik dönüşü + sayfa başına kaydır. */
  const goToBrandHome = useCallback(() => {
    resetToWritingsFeed();
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [resetToWritingsFeed]);

  const closeFooterInfo = useCallback(() => {
    setFooterInfoOpen(null);
  }, []);

  useEffect(() => {
    if (!footerInfoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFooterInfoOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [footerInfoOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => {
      setHeaderEditorialIdx((i) => (i + 1) % HEADER_ATATURK_QUOTES.length);
    }, 14000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (isOAuthReturnQuery(searchParams)) return;
    const raw = searchParams.get("entry");
    const urlEntryId =
      raw && isRealUuid(decodeURIComponent(raw.trim()))
        ? decodeURIComponent(raw.trim())
        : null;
    if (urlEntryId) {
      writePendingReturn(urlEntryId, "comment");
    }
  }, [searchParams]);

  /** OAuth dönüşü: entry URL açma; pending temiz, ana sayfa. */
  useEffect(() => {
    if (!isOAuthReturnQuery(searchParams)) return;
    clearPendingReturn();
    setCenterMode("feed");
    void routerRef.current.replace("/", { scroll: false });
  }, [searchParams]);

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
    if (!isUserMenuOpen) {
      setAccountDeleteStep("idle");
      setAccountDeleteError(null);
      return;
    }
    const onDocClick = (e: MouseEvent) => {
      const el = accountMenuRef.current;
      if (el && !el.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsUserMenuOpen(false);
    };
    const t = window.setTimeout(() => {
      document.addEventListener("click", onDocClick, false);
    }, 100);
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("click", onDocClick, false);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [isUserMenuOpen]);

  useEffect(() => {
    setFeedVisibleCount(FEED_PAGE_SIZE);
  }, [searchQuery]);

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
    if (platformAccessSuspended) {
      if (centerMode === "agreement") {
        setCenterMode("feed");
      }
      return;
    }
    if (!agreementDone) {
      setCenterMode("agreement");
      return;
    }
    if (centerMode === "auth") {
      const pending = readPendingFromStorage().entryId;
      if (pending) {
        const found = centerEntries.find((e) => e.id === pending);
        const path = entryHrefPath(found, pending);
        void router.push(`/${encodeURI(path)}`);
        clearPendingReturn();
      } else {
        setCenterMode("feed");
      }
    }
  }, [
    isAuthenticated,
    agreementDone,
    platformAccessSuspended,
    centerMode,
    centerEntries,
    router,
  ]);

  const persistStateBeforeOAuth = useCallback(() => {
    const id = centerEntries[0]?.id ?? null;
    if (!id) return;
    writePendingReturn(id, "comment");
  }, [centerEntries]);

  /**
   * Üst ana bloklar: pending → trending → memory → today.
   * usedEntryIds yalnızca bu dörtlü arasında tekrarı keser; alt keşif panelleri
   * ayrı hesaplanır (üstte kullanılmış legacy orada yine gösterilebilir).
   */
  const {
    rightRailAwaitingFirstComment,
    mostCommentedEntries,
    shuffledMainFeedEntries,
    todayDiscoveryEntries,
  } = useMemo(() => {
    const withCounts = centerEntries.map((entry) => ({
      entry,
      commentCount: commentsByEntryIdLive[entry.id]?.length ?? 0,
    }));

    const sortByComments = (
      a: (typeof withCounts)[0],
      b: (typeof withCounts)[0]
    ) => {
      if (b.commentCount !== a.commentCount) {
        return b.commentCount - a.commentCount;
      }
      return compareEntriesByNewest(a.entry, b.entry);
    };

    const sortByEngagement = (
      a: (typeof withCounts)[0],
      b: (typeof withCounts)[0]
    ) => {
      if (b.commentCount !== a.commentCount) {
        return b.commentCount - a.commentCount;
      }
      return compareEntriesByNewest(a.entry, b.entry);
    };

    const sortRanked = sortByEngagement;

    const usedEntryIds = new Set<string>();

    // 1. pending — Yazılmayı bekleyenler
    const pendingTagged = withCounts
      .filter((w) => entryPublishSlug(w.entry) === "pending")
      .sort((a, b) => compareEntriesByNewest(a.entry, b.entry));
    const pendingList: EntryItem[] = [];
    for (const row of pendingTagged) {
      if (pendingList.length >= 12) break;
      pendingList.push(row.entry);
      usedEntryIds.add(row.entry.id);
    }
    if (pendingList.length < 12) {
      const zeros = withCounts
        .filter(
          (r) =>
            !hasAdminPublishSection(r.entry) &&
            r.commentCount === 0
        )
        .sort((a, b) => compareEntriesByNewest(a.entry, b.entry));
      for (const row of zeros) {
        if (pendingList.length >= 12) break;
        if (!usedEntryIds.has(row.entry.id)) {
          pendingList.push(row.entry);
          usedEntryIds.add(row.entry.id);
        }
      }
    }

    // 2. trending — Şu an en çok konuşulanlar
    const trendingTagged = withCounts
      .filter((w) => entryPublishSlug(w.entry) === "trending")
      .sort(sortByComments);
    const trendingList: EntryItem[] = [];
    for (const row of trendingTagged) {
      if (trendingList.length >= 10) break;
      trendingList.push(row.entry);
      usedEntryIds.add(row.entry.id);
    }
    if (trendingList.length < 10) {
      const legacyRanked = withCounts
        .filter((w) => !hasAdminPublishSection(w.entry))
        .sort(sortByComments);
      for (const row of legacyRanked) {
        if (trendingList.length >= 10) break;
        if (!usedEntryIds.has(row.entry.id)) {
          trendingList.push(row.entry);
          usedEntryIds.add(row.entry.id);
        }
      }
    }

    // 3. today — Bugün 61Larus’ta (vitrin; memory’den önce — yoksa usedEntryIds vitrini boşaltıyordu)
    const todayTagged = withCounts
      .filter((r) => entryPublishSlug(r.entry) === "today")
      .sort(sortRanked);
    const todayList: EntryItem[] = [];
    for (const row of todayTagged) {
      if (todayList.length >= 4) break;
      todayList.push(row.entry);
    }
    if (todayList.length < 4) {
      const ranked = [...withCounts].sort(sortRanked);
      for (const row of ranked) {
        if (todayList.length >= 4) break;
        if (!todayList.some((e) => e.id === row.entry.id)) {
          todayList.push(row.entry);
        }
      }
    }
    for (const e of todayList) usedEntryIds.add(e.id);

    // 4. memory — Hafızaya eklenenler (ana akış)
    const memoryExplicit = centerEntries
      .filter((e) => entryPublishSlug(e) === "memory")
      .sort(compareEntriesByNewest);
    const memoryLegacy = centerEntries
      .filter(
        (e) =>
          !hasAdminPublishSection(e) && !usedEntryIds.has(e.id)
      )
      .sort(compareEntriesByNewest);
    const memoryList = [...memoryExplicit, ...memoryLegacy].sort(
      compareEntriesByNewest
    );
    for (const e of memoryList) usedEntryIds.add(e.id);

    return {
      rightRailAwaitingFirstComment: pendingList,
      mostCommentedEntries: trendingList,
      shuffledMainFeedEntries: memoryList,
      todayDiscoveryEntries: todayList,
    };
  }, [centerEntries, commentsByEntryIdLive]);

  /** Alt keşif: üst bloklardan bağımsız; yalnızca publish atanmamış legacy. */
  const waitingEntriesForExplore = useMemo(() => {
    return [...centerEntries]
      .filter((entry) => !hasAdminPublishSection(entry))
      .sort(compareEntriesByNewest)
      .slice(0, 4);
  }, [centerEntries]);

  const starterEntries = useMemo(() => {
    const withMeta = centerEntries.map((entry) => ({
      entry,
      commentCount: commentsByEntryIdLive[entry.id]?.length ?? 0,
    }));
    const sortByEngagement = (
      a: (typeof withMeta)[0],
      b: (typeof withMeta)[0]
    ) => {
      if (b.commentCount !== a.commentCount) {
        return b.commentCount - a.commentCount;
      }
      return compareEntriesByNewest(a.entry, b.entry);
    };
    const understandTagged = withMeta
      .filter((w) => entryPublishSlug(w.entry) === "understand_trabzon")
      .sort(sortByEngagement);
    const picked: EntryItem[] = [];
    const usedLocal = new Set<string>();
    for (const w of understandTagged) {
      if (picked.length >= 4) break;
      picked.push(w.entry);
      usedLocal.add(w.entry.id);
    }
    const encyclopedic = withMeta
      .filter(
        (w) =>
          !usedLocal.has(w.entry.id) &&
          !hasAdminPublishSection(w.entry) &&
          isStarterEncyclopediaEntry(w.entry)
      )
      .sort(sortByEngagement);
    for (const w of encyclopedic) {
      if (picked.length >= 4) break;
      picked.push(w.entry);
      usedLocal.add(w.entry.id);
    }
    if (picked.length < 4) {
      const rest = withMeta
        .filter(
          (w) =>
            !usedLocal.has(w.entry.id) && !hasAdminPublishSection(w.entry)
        )
        .sort(sortByEngagement);
      for (const w of rest) {
        if (picked.length >= 4) break;
        picked.push(w.entry);
      }
    }
    return picked;
  }, [centerEntries, commentsByEntryIdLive]);

  const dailyQuestionEntries = useMemo((): EntryItem[] => {
    if (centerEntries.length === 0) return [];
    const withMeta = centerEntries.map((entry) => ({
      entry,
      commentCount: commentsByEntryIdLive[entry.id]?.length ?? 0,
    }));
    const sortByEngagement = (
      a: (typeof withMeta)[0],
      b: (typeof withMeta)[0]
    ) => {
      if (b.commentCount !== a.commentCount) {
        return b.commentCount - a.commentCount;
      }
      return compareEntriesByNewest(a.entry, b.entry);
    };
    const picked: EntryItem[] = [];
    const used = new Set<string>();
    const pushUpTo4 = (rows: typeof withMeta) => {
      for (const w of rows) {
        if (picked.length >= 4) break;
        if (!used.has(w.entry.id)) {
          picked.push(w.entry);
          used.add(w.entry.id);
        }
      }
    };

    const questionTagged = withMeta
      .filter((w) => entryPublishSlug(w.entry) === "question_of_day")
      .sort(sortByEngagement);
    pushUpTo4(questionTagged);

    const legacyCandidates = (pred: (w: (typeof withMeta)[0]) => boolean) =>
      withMeta
        .filter(
          (w) =>
            !hasAdminPublishSection(w.entry) &&
            !used.has(w.entry.id) &&
            pred(w)
        )
        .sort(sortByEngagement);

    if (picked.length < 4) {
      pushUpTo4(legacyCandidates((w) => w.entry.title.includes("?")));
    }
    if (picked.length < 4) {
      pushUpTo4(
        legacyCandidates(
          (w) => normalizeEntryCategory(w.entry.category) === "gundem"
        )
      );
    }
    if (picked.length < 4) {
      pushUpTo4(legacyCandidates(() => true));
    }

    return picked;
  }, [centerEntries, commentsByEntryIdLive]);

  const hasHomeExplore =
    starterEntries.length > 0 ||
    waitingEntriesForExplore.length > 0 ||
    dailyQuestionEntries.length > 0;

  /** Alt keşif geçiş ticker’ı — yalnızca mevcut props listeleri; ek sorgu yok. */
  const homeExploreTickerEntries = useMemo((): EntryItem[] => {
    const seen = new Set<string>();
    const out: EntryItem[] = [];
    const take = (list: EntryItem[]) => {
      for (const e of list) {
        if (out.length >= 12) return;
        if (!e?.title?.trim() || seen.has(e.id)) continue;
        seen.add(e.id);
        out.push(e);
      }
    };
    take(todayDiscoveryEntries);
    take(shuffledMainFeedEntries);
    take(mostCommentedEntries);
    take(rightRailAwaitingFirstComment);
    take(starterEntries);
    take(dailyQuestionEntries);
    take(waitingEntriesForExplore);
    if (out.length < 12) take(centerEntries);
    return out;
  }, [
    todayDiscoveryEntries,
    shuffledMainFeedEntries,
    mostCommentedEntries,
    rightRailAwaitingFirstComment,
    starterEntries,
    dailyQuestionEntries,
    waitingEntriesForExplore,
    centerEntries,
  ]);

  const feedEntriesSearchFiltered = useMemo(() => {
    let list = shuffledMainFeedEntries;
    if (searchQuery.trim()) {
      list = list.filter((e) => entryMatchesSearch(e, searchQuery));
    }
    return list;
  }, [shuffledMainFeedEntries, searchQuery]);

  const mainColumnDisplayEntries = useMemo(() => {
    const list = feedEntriesSearchFiltered;
    return list.slice(0, feedVisibleCount);
  }, [feedEntriesSearchFiltered, feedVisibleCount]);

  const feedHasMore = useMemo(
    () => feedVisibleCount < feedEntriesSearchFiltered.length,
    [feedVisibleCount, feedEntriesSearchFiltered.length]
  );

  async function onAgreementSuccess() {
    setAgreementDone(true);
    setOnboardingDone(true);
    agreementDoneRef.current = true;
    onboardingDoneRef.current = true;

    const raw = searchParams.get("entry");
    const urlEntryId =
      raw && isRealUuid(decodeURIComponent(raw.trim()))
        ? decodeURIComponent(raw.trim())
        : null;
    const pending = readPendingFromStorage().entryId;
    const id = urlEntryId ?? pending;
    if (id) {
      const found = centerEntries.find((e) => e.id === id);
      const path = entryHrefPath(found, id);
      void router.push(`/${encodeURI(path)}`);
      clearPendingReturn();
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
    setAgreementDone(false);
    setOnboardingDone(false);
    await router.refresh();
  }

  async function handleLogout() {
    setIsUserMenuOpen(false);
    await resetSessionToGuest();
    if (typeof window !== "undefined") {
      window.location.reload();
    }
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
      setIsUserMenuOpen(false);
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
        <div className="feed-index-empty-message flex min-h-[160px] items-center justify-center border-t border-dashed border-[color:var(--divide-hair)] px-0 py-14 text-center">
          Henüz içerik yok
        </div>
      );
    }
    if (feedEntriesSearchFiltered.length === 0) {
      const hasSearch = searchQuery.trim().length > 0;
      return (
        <div className="feed-search-empty border-t border-[color:var(--divide-hair)] px-0 py-16 text-center md:py-20">
          <p className="feed-search-empty-title m-0">
            {hasSearch
              ? "Aramana uygun yazı yok."
              : "Aramana uygun bir yazı bulunamadı."}
          </p>
          <p className="feed-search-empty-hint m-0 mt-3 max-w-[22rem] mx-auto">
            {hasSearch
              ? "Farklı bir kelime veya ifade dene; aramayı boşaltıp tüm yazılara dön."
              : "Farklı bir kelime deneyebilirsin."}
          </p>
        </div>
      );
    }
    return (
      <div className="relative z-0 pb-5 md:pb-8">
        <nav className="flex flex-col" aria-label="Hafızaya eklenen yazılar">
          {mainColumnDisplayEntries.map((entry) => {
            const cc = commentsByEntryIdLive[entry.id]?.length ?? 0;
            return (
              <FeedEntryCard
                key={entry.id}
                title={entry.title}
                contentPreview={entry.content}
                commentCount={cc}
                authorLabel={entry.authorName?.trim() || "61Larus"}
                metaDate={formatFeedLineDate(entry.created_at)}
                createdAtRaw={entry.created_at}
                isActive={false}
                onSelect={() => goToEntry(entry.id)}
              />
            );
          })}
        </nav>
        {feedHasMore ? (
          <button
            type="button"
            onClick={() => {
              setFeedVisibleCount((c) => c + FEED_PAGE_SIZE);
            }}
            className="feed-load-more feed-load-more--faz55 feed-load-more--calm mt-6 w-full min-h-[3rem] border-0 bg-transparent py-3 text-center underline decoration-[color:var(--divide-muted)] decoration-1 underline-offset-[5px] transition-colors hover:text-[color:var(--text-primary)] hover:decoration-[color:var(--border-subtle)] md:mt-6 md:min-h-0 md:py-3.5"
          >
            Daha fazla yazı yükle ↓
          </button>
        ) : null}
      </div>
    );
  }

  function renderFooterInfoPanel() {
    if (!footerInfoOpen) return null;

    const titleId = `footer-info-title-${footerInfoOpen}`;
    let body: ReactNode = null;

    switch (footerInfoOpen) {
      case "about":
        body = (
          <div className="site-info-stack">
            <p className="site-info-p">
              <strong className="site-info-strong">61Larus</strong>, kayıtlar,
              yorumlar ve başlıkların bir arada durduğu, Trabzon eksenli bir
              okuma ve yazım yüzeyidir. Akış gazete disiplinine yakındır;
              gürültüyü değil düşünce sırasını öne alır.
            </p>
            <p className="site-info-p">
              Şehrin gündemi, mahalle hafızası ve ortak meseleler, tek bir
              yaşayan metin deposunda buluşur. Amaç hızlı tüketim değil; geri
              dönülebilecek, sakin ve güvenilir bir bilgi bankası oluşturmaktır.
            </p>
            <p className="site-info-p site-info-p--manifesto">
              Burada metin önceliklidir. Yerel kök korunur; dil evrensel ve
              saygılı tutulur. Okumak, yazmak ve hatırlamak aynı çizgidedir.
            </p>
          </div>
        );
        break;
      case "rules":
        body = (
          <ul className="site-info-list">
            <li>
              Kişi veya topluluklara yönelik hakaret, tehdit ve nefret dili
              kullanma.
            </li>
            <li>
              Yanıltıcı başlık veya kasıtlı bağlam koparmasından kaçın; okuru
              yanıltma.
            </li>
            <li>
              Yorumları kısa ve tartışmaya açık tut; spam ve anlamsız tekrar
              gönderimde bulunma.
            </li>
            <li>
              Başkasının özel alanına saygı duy; gereksiz kişisel veri paylaşma.
            </li>
            <li>
              Platform düzenini bozacak organize taciz veya manipülasyonda
              bulunma.
            </li>
            <li>
              Paylaşımlarının yürürlükteki düzenlemeler ve kamu düzeniyle uyumlu
              olmasına dikkat et.
            </li>
          </ul>
        );
        break;
      case "privacy":
        body = (
          <div className="site-info-stack">
            <p className="site-info-p">
              Oturum açarken kimliğini doğrulamak için üçüncü taraf sağlayıcılar
              (örneğin Google) kullanılabilir. Bu süreçte paylaşılan temel profil
              ve e-posta bilgisi hesabını korumak ve oturumu yönetmek için
              işlenir.
            </p>
            <p className="site-info-p">
              Yazı ve yorum içerikleri sana aittir. Hesap kapatma veya
              anonimleştirme seçenekleri uygulama içinde açıklandığı biçimde
              uygulanır.
            </p>
            <p className="site-info-p">
              Reklam profili oluşturan çerezlerle izleme yapmıyoruz. Güvenlik ve
              işleyiş için gerekli teknik kayıtlar tutulabilir.
            </p>
          </div>
        );
        break;
      case "contact":
        body = (
          <div className="site-info-stack">
            <p className="site-info-p">
              Soru, öneri veya teknik bildirimlerin için aşağıdaki kanalı
              kullanabilirsin. Yanıt süresi iş yüküne bağlı olarak değişebilir.
            </p>
            <div
              onClick={() =>
                window.open("https://wa.me/905400010462", "_blank")
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "rgba(37, 211, 102, 0.08)",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#25D366",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M20.52 3.48A11.8 11.8 0 0 0 12.01 0C5.38 0 .01 5.38.01 12c0 2.11.55 4.17 1.6 5.99L0 24l6.19-1.61A11.96 11.96 0 0 0 12.01 24c6.63 0 12-5.38 12-12 0-3.2-1.25-6.2-3.49-8.52z" />
                </svg>
              </div>

              <span style={{ fontWeight: 500 }}>
                WhatsApp danışma hattı
              </span>
            </div>
          </div>
        );
        break;
    }

    const heading =
      footerInfoOpen === "about"
        ? "Hakkında"
        : footerInfoOpen === "rules"
          ? "Kurallar"
          : footerInfoOpen === "privacy"
            ? "Gizlilik"
            : "İletişim";

    return (
      <div
        className="fixed inset-0 z-[92] flex items-start justify-center overflow-y-auto bg-[color:var(--overlay-scrim)] px-3 py-5 backdrop-blur-[1px] md:items-center md:py-8"
        role="presentation"
        onClick={() => closeFooterInfo()}
      >
        <div
          className="site-info-dialog my-auto w-full max-w-[32rem] border border-[color:var(--divide)] bg-[var(--bg-secondary)] shadow-[var(--shadow-modal)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="left-scroll max-h-[min(88dvh,720px)] overflow-y-auto overscroll-contain">
            <div className="site-info-panel-inner px-5 py-6 md:px-8 md:py-7">
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <button
                  type="button"
                  onClick={() => closeFooterInfo()}
                  className="entry-detail-back"
                >
                  kapat
                </button>
              </div>
              <h2 id={titleId} className="site-info-title">
                {heading}
              </h2>
              <div className="site-info-body">{body}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen w-full max-w-full flex-col bg-transparent text-[color:var(--text-primary)] antialiased">
      <header className="site-header relative z-20 shrink-0">
        <div className="headerBlock home-page-container">
          <div className="headerBar min-w-0">
            <div className="flex min-w-0 flex-col gap-2 lg:max-w-[min(21rem,100%)]">
              <h1 className="m-0 p-0">
                <button
                  type="button"
                  onClick={goToBrandHome}
                  className="site-wordmark max-w-full border-0 bg-transparent p-0 text-left transition-opacity duration-200 hover:opacity-88"
                  style={{ fontFeatureSettings: '"ss01" 1, "cv01" 1' }}
                  aria-label="Ana sayfa — Akış"
                >
                  61Larus
                </button>
              </h1>
              <p className="site-header-tagline m-0 site-header-tagline--manifesto">
                TRABZON&apos;UN GÜNDEMİ, LAFI VE HAFIZASI
              </p>
            </div>
          <div
            className="headerCenterText site-header-editorial"
            aria-live="polite"
            aria-atomic="true"
            aria-label="Atatürk sözleri"
          >
            <p
              key={headerEditorialIdx}
              className="site-header-editorial-text m-0"
            >
              {HEADER_ATATURK_QUOTES[headerEditorialIdx]}
            </p>
          </div>
          <div className="headerUserName site-header-aux min-w-0 justify-self-end gap-x-3 pl-1 sm:gap-x-4 lg:shrink-0 lg:gap-x-4 lg:pl-2 lg:pr-3">
            {!isAuthenticated ? (
                <Link
                  href="/auth"
                  className="inline-flex shrink-0 items-center font-normal tracking-[0.04em] text-[color:var(--text-tertiary)] underline decoration-[color:var(--divide-muted)] decoration-1 underline-offset-[5px] transition-colors hover:text-[color:var(--text-secondary)]"
                >
                  Giriş
                </Link>
            ) : null}
            {isAuthenticated ? (
                <div
                  className="relative z-30 min-w-0 shrink-0"
                  ref={accountMenuRef}
                >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsUserMenuOpen((o) => !o);
                  }}
                  className="account-menu-name-trigger max-w-full cursor-pointer border-0 bg-transparent p-0"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Hesap menüsü"
                >
                  <div
                    className="account-menu-trigger-inner flex min-h-9 min-w-0 max-w-full items-center justify-end rounded-md px-0.5 py-0.5 text-[color:var(--text-tertiary)] transition-colors duration-150 hover:text-[color:var(--text-secondary)]"
                    style={{ transition: "var(--transition)" }}
                  >
                    <span className="account-menu-handle header-user mobileHeaderUserName block min-w-0 max-w-full truncate text-right">
                      {userEmail?.split("@")[0] || "kullanıcı"}
                    </span>
                  </div>
                </button>
                {isUserMenuOpen ? (
                  <div
                    className="account-menu-panel user-menu"
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="account-menu-meta m-0">
                      Google ile giriş yapıldı
                    </p>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handleLogout()}
                      className="account-menu-item account-menu-item--default"
                    >
                      Çıkış yap
                    </button>
                    {accountDeleteStep === "idle" ? (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={accountDeleteLoading}
                        onClick={() => setAccountDeleteStep("confirm")}
                        className="account-menu-item account-menu-item--destructive"
                      >
                        Google hesabımı sil
                      </button>
                    ) : (
                      <div className="account-menu-delete-block">
                        <p className="account-menu-delete-hint m-0">
                          Bu işlem geri alınamaz. Profil bilgilerin kaldırılır; eski
                          içerikler anonim görünür.
                        </p>
                        <div className="account-menu-delete-actions">
                          <button
                            type="button"
                            disabled={accountDeleteLoading}
                            onClick={() => void handleConfirmAccountDeletion()}
                            className="account-menu-delete-confirm"
                          >
                            {accountDeleteLoading ? "İşleniyor…" : "Silmeyi onayla"}
                          </button>
                          <button
                            type="button"
                            disabled={accountDeleteLoading}
                            onClick={() => setAccountDeleteStep("idle")}
                            className="account-menu-delete-cancel"
                          >
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    )}
                    {accountDeleteError ? (
                      <p className="account-menu-error m-0">{accountDeleteError}</p>
                    ) : null}
                  </div>
                ) : null}
                </div>
            ) : null}
          </div>
          </div>
        </div>
      </header>

      <section
        className={
          centerMode === "auth" || centerMode === "agreement"
            ? "relative z-0 flex w-full flex-col"
            : "relative z-0 flex w-full flex-col border-0 bg-[var(--bg-primary)]"
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
          <>
            {isAuthenticated && platformAccessSuspended ? (
              <div
                className="platform-access-suspended-notice"
                role="status"
              >
                Hesabın platform kullanımı (yorum ve benzeri etkileşim) yönetici
                tarafından geçici olarak durduruldu. İçerikleri okuyabilirsin; erişim
                hakkında destek almak için{" "}
                <button
                  type="button"
                  className="platform-access-suspended-notice__link"
                  onClick={() => setFooterInfoOpen("contact")}
                >
                  İletişim
                </button>{" "}
                üzerinden bize ulaşabilirsin.
              </div>
            ) : null}
            <div className="home-page-editorial home-page-editorial--section-stack">
            <div
              className="home-manifesto home-manifesto--bridge home-search-bridge home-manifesto-inner--bridge home-search-field min-w-0 w-full max-w-full"
            >
              <div className="home-manifesto-search">
                <label
                  htmlFor="feed-search-input"
                  className="sr-only"
                >
                  Arama
                </label>
                <input
                  id="feed-search-input"
                  name="q"
                  type="search"
                  className="home-manifesto-input home-manifesto-input--premium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Başlık ara..."
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
            {todayDiscoveryEntries.length > 0 ? (
              <section
                className="today-strip today-discovery today-discovery--vitrin today-discovery--faz5 today-discovery--settled"
                aria-labelledby="today-discovery-title"
              >
                <div className="today-discovery-head">
                  <h2
                    id="today-discovery-title"
                    className="today-discovery-kicker m-0"
                  >
                    Bugün 61Larus’ta
                  </h2>
                </div>
                <div
                  className="today-discovery-grid"
                  role="list"
                  aria-label="Bugün vurgulanan yazılar"
                >
                  {todayDiscoveryEntries.map((entry, index) => {
                    const num = String(index + 1).padStart(2, "0");
                    const cc =
                      commentsByEntryIdLive[entry.id]?.length ?? 0;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        role="listitem"
                        className="today-discovery-item"
                        onClick={() => goToEntry(entry.id)}
                        aria-label={`Aç: ${entry.title}, ${cc} yorum`}
                      >
                        <span
                          className="today-discovery-number"
                          aria-hidden
                        >
                          {num}
                        </span>
                        <span className="today-discovery-title">
                          {entry.title}
                        </span>
                        <div
                          className="today-discovery-item-foot"
                          aria-hidden
                        >
                          <span className="today-discovery-item-stat">
                            {cc} yorum
                          </span>
                          <span className="today-discovery-item-open">
                            Yazıyı aç →
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}
            <div className="home-main-columns-wrap home-main-columns-wrap--faz51 home-main-columns-wrap--faz56 min-h-0 w-full min-w-0 max-w-full">
            <div className="main-3col home-editorial-cols home-editorial-cols--faz52 home-content-grid home-content-grid--editorial home-content-grid--flow home-content-grid--faz3 flex w-full min-h-0 min-w-0 max-w-full flex-col gap-0 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2.1fr)] md:items-stretch md:gap-0 md:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2.1fr)]">
            <aside
              className="home-rail home-rail--awaiting home-rail--faz5-left home-rail--editorial-col home-rail--column await-col flex max-h-[42vh] w-full min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-b border-[color:var(--editorial-hairline)] bg-transparent md:max-h-none md:w-full md:max-w-none md:overflow-hidden md:border-b-0"
              aria-label="Yazılmayı bekleyenler"
            >
              <div className="col-section-head col-head-band col-head-band--faz52-support col-head-band--settled home-rail-header home-rail-header--col shrink-0 px-3.5 md:px-4">
                <h2 className="col-section-head__title col-section-head__title--rail m-0">
                  Yazılmayı bekleyenler
                </h2>
              </div>
              <div className="home-rail-body home-rail-body--awaiting col-list-panel left-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <nav
                  className="home-rail-nav home-rail-nav--faz52-support home-rail-nav--awaiting flex flex-col px-2.5 pb-4 md:px-3.5 md:pb-5"
                  aria-label="Henüz yorum almamış başlıklar"
                >
                  {rightRailAwaitingFirstComment.map((entry, index) => {
                    const isActive = false;
                    const rank = index + 1;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => goToEntry(entry.id)}
                        className={`home-index-row group flex w-full items-start gap-2.5 border-0 border-b border-[color:var(--editorial-hairline)] py-2.5 pl-0.5 pr-1 text-left last:border-b-0 md:gap-3 md:py-2.5 md:pl-1 ${
                          isActive
                            ? "home-index-row--active"
                            : "bg-transparent"
                        }`}
                      >
                        <span
                          className="home-index-num w-[1.2rem] shrink-0 text-right tabular-nums md:w-[1.35rem]"
                          aria-hidden
                        >
                          {String(rank).padStart(2, "0")}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="home-index-title line-clamp-2">
                            {entry.title}
                          </span>
                          <span className="home-index-meta">0 yorum</span>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </aside>
            <aside
              className="home-rail home-rail--trending home-rail--faz5-mid home-rail--editorial-col home-rail--column flex max-h-[40vh] w-full min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-b border-[color:var(--editorial-hairline)] bg-transparent md:max-h-none md:w-full md:max-w-none md:overflow-hidden md:border-b-0"
              aria-label="En çok konuşulan başlıklar"
            >
              <div className="col-section-head col-head-band col-head-band--faz52-support col-head-band--settled col-head-band--trending home-rail-header home-rail-header--col shrink-0 px-3.5 md:px-4">
                <h2 className="col-section-head__title col-section-head__title--rail m-0">
                  En çok konuşulan başlıklar
                </h2>
              </div>
              <div className="home-rail-body home-rail-body--trending col-list-panel left-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <nav
                  className="home-rail-nav home-rail-nav--faz52-support flex flex-col px-2.5 pb-4 md:px-3.5 md:pb-5"
                  aria-label="En çok konuşulan başlıklar"
                >
                  {mostCommentedEntries.map((entry, index) => {
                    const cc = commentsByEntryIdLive[entry.id]?.length ?? 0;
                    const isActive = false;
                    const rank = index + 1;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => goToEntry(entry.id)}
                        className={`home-index-row group flex w-full items-start gap-2.5 border-0 border-b border-[color:var(--editorial-hairline)] py-2.5 pl-0.5 pr-1 text-left last:border-b-0 md:gap-3 md:py-2.5 md:pl-1 ${
                          isActive
                            ? "home-index-row--active"
                            : "bg-transparent"
                        }`}
                      >
                        <span
                          className="home-index-num w-[1.2rem] shrink-0 text-right tabular-nums md:w-[1.35rem]"
                          aria-hidden
                        >
                          {String(rank).padStart(2, "0")}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="home-index-title line-clamp-2">
                            {entry.title}
                          </span>
                          <span className="home-index-meta">
                            {cc} yorum
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </aside>
            <main className="main-column home-rail--center home-rail--faz5-primary home-rail--editorial-col home-rail--feed-main feed-col flex min-h-0 min-w-0 w-full flex-col bg-transparent md:h-auto md:min-h-0 md:max-h-none md:overflow-visible lg:min-h-0 lg:max-h-full lg:h-full lg:overflow-hidden">
              <div className="home-feed-rail home-feed-rail--faz55 layout-feed-inner layout-feed-inner--post-manifesto mx-auto flex w-full min-h-0 min-w-0 max-w-none flex-1 flex-col px-0 py-5 sm:py-6 md:h-auto md:min-h-0 md:flex-none md:py-0 lg:min-h-0 lg:max-h-full lg:h-full lg:flex-1">
                <div className="col-section-head col-head-band col-head-band--feed col-head-band--faz5-primary col-head-band--settled home-feed-rail__head home-rail-header--col shrink-0">
                  <h2
                    className="col-section-head__title col-section-head__title--rail m-0"
                    id="main-feed-title"
                  >
                    Hafızaya eklenenler
                  </h2>
                </div>
                <div className="home-feed-rail__body home-feed-rail__body--faz55 home-rail-body home-rail-body--feed col-list-panel min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain max-md:left-scroll max-md:overscroll-contain md:min-h-0 md:flex-1 md:overflow-y-auto md:overflow-x-hidden md:overscroll-contain lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overflow-x-hidden lg:overscroll-contain">
                  {renderMainFeed()}
                </div>
              </div>
            </main>
            </div>
            </div>

            {hasHomeExplore ? (
              <section
                className="home-explore home-explore--prefooter home-explore--after-main-columns home-explore--faz51"
                aria-label="Keşif alanı"
              >
                  <header
                    className={
                      "col-section-head col-explore-section-head home-explore-head home-explore-head--section-start col-head-band--settled home-explore-head--settled home-explore-head--transition" +
                      (homeExploreTickerEntries.length > 0
                        ? " home-explore-head--transition-has-ticker"
                        : "")
                    }
                    {...(homeExploreTickerEntries.length > 0
                      ? { "aria-label": "Öne çıkan başlıklar" }
                      : { "aria-hidden": true })}
                  >
                    {homeExploreTickerEntries.length > 0 ? (
                      <div className="home-explore-ticker">
                        <div className="home-explore-ticker-viewport">
                          <div className="home-explore-ticker-track">
                            <div className="home-explore-ticker-group">
                              {homeExploreTickerEntries.map((entry) => (
                                <Fragment key={entry.id}>
                                  <span
                                    className="home-explore-ticker-sep"
                                    aria-hidden
                                  >
                                    •
                                  </span>
                                  <button
                                    type="button"
                                    className="home-explore-ticker-hit"
                                    onClick={() => goToEntry(entry.id)}
                                    aria-label={`Aç: ${entry.title}`}
                                  >
                                    {entry.title}
                                  </button>
                                </Fragment>
                              ))}
                            </div>
                            <div
                              className="home-explore-ticker-group"
                              aria-hidden="true"
                            >
                              {homeExploreTickerEntries.map((entry) => (
                                <Fragment key={`${entry.id}-mirror`}>
                                  <span className="home-explore-ticker-sep">
                                    •
                                  </span>
                                  <span className="home-explore-ticker-ghost">
                                    {entry.title}
                                  </span>
                                </Fragment>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </header>
                  <div className="home-explore-grid items-stretch">
                    {starterEntries.length > 0 ? (
                      <div className="home-explore-panel home-explore-panel--starter flex h-full min-h-0 flex-col">
                        <header className="col-section-head home-explore-panel-head shrink-0">
                          <h3 className="home-explore-panel-label m-0">
                            Trabzon&apos;u anlamak için
                          </h3>
                        </header>
                        <div className="home-explore-panel-body flex min-h-0 min-w-0 flex-1 flex-col">
                          <ul className="home-explore-list" role="list">
                            {starterEntries.map((entry) => {
                              const cc =
                                commentsByEntryIdLive[entry.id]?.length ?? 0;
                              return (
                                <li key={entry.id}>
                                  <button
                                    type="button"
                                    className="home-explore-item"
                                    onClick={() => goToEntry(entry.id)}
                                    aria-label={`Aç: ${entry.title}`}
                                  >
                                    <span className="home-explore-item-title">
                                      {entry.title}
                                    </span>
                                    <div className="home-explore-item-foot">
                                      <span className="home-explore-item-meta">
                                        {cc} yorum
                                      </span>
                                      <span className="home-explore-cta home-explore-cta--row">
                                        Yazıyı aç →
                                      </span>
                                    </div>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    ) : null}
                    {waitingEntriesForExplore.length > 0 ? (
                      <div className="home-explore-panel home-explore-panel--waiting flex h-full min-h-0 flex-col">
                        <header className="col-section-head home-explore-panel-head shrink-0">
                          <h3 className="home-explore-panel-label m-0">
                            Okunmayı bekleyenler
                          </h3>
                        </header>
                        <div className="home-explore-panel-body flex min-h-0 min-w-0 flex-1 flex-col">
                          <ul className="home-explore-list" role="list">
                            {waitingEntriesForExplore.map((entry) => {
                              const wcc =
                                commentsByEntryIdLive[entry.id]?.length ?? 0;
                              return (
                              <li key={entry.id}>
                                <button
                                  type="button"
                                  className="home-explore-item"
                                  onClick={() => goToEntry(entry.id)}
                                  aria-label={`Aç: ${entry.title}`}
                                >
                                  <span className="home-explore-item-title">
                                    {entry.title}
                                  </span>
                                  <div className="home-explore-item-foot">
                                    <span className="home-explore-item-meta">
                                      {wcc} yorum
                                    </span>
                                    <span className="home-explore-cta home-explore-cta--row">
                                      Yazıyı aç →
                                    </span>
                                  </div>
                                </button>
                              </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    ) : null}
                    {dailyQuestionEntries.length > 0 ? (
                      <div className="home-explore-panel home-explore-panel--question flex h-full min-h-0 flex-col">
                        <header className="col-section-head home-explore-panel-head shrink-0">
                          <h3 className="home-explore-panel-label m-0">
                            Günün soruları
                          </h3>
                        </header>
                        <div className="home-explore-panel-body flex min-h-0 min-w-0 flex-1 flex-col">
                          <div
                            className="home-explore-questions-grid min-h-0 flex-1"
                            role="list"
                            aria-label="Günün soruları"
                          >
                            {dailyQuestionEntries.map((entry) => {
                              const cc =
                                commentsByEntryIdLive[entry.id]?.length ?? 0;
                              return (
                                <button
                                  key={entry.id}
                                  type="button"
                                  role="listitem"
                                  className="home-explore-question home-explore-question--stack w-full max-w-full text-left"
                                  onClick={() => goToEntry(entry.id)}
                                  aria-label={`Aç: ${entry.title}`}
                                >
                                  <span className="home-explore-item-title home-explore-questions-grid__title">
                                    {entry.title}
                                  </span>
                                  <div className="home-explore-item-foot">
                                    <span className="home-explore-item-meta">
                                      {cc} yorum
                                    </span>
                                    <span className="home-explore-cta home-explore-cta--row">
                                      Yazıyı aç →
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
              </section>
            ) : null}
            </div>

            <footer
              id="site-footer"
              className="site-footer home-page-footer home-page-footer--after-explore"
            >
              <div className="home-page-container flex flex-col gap-7 md:flex-row md:items-baseline md:justify-between md:gap-8">
                <button
                  type="button"
                  onClick={goToBrandHome}
                  className="site-wordmark border-0 bg-transparent p-0 text-left transition-opacity duration-200 hover:opacity-90"
                >
                  61Larus
                </button>
                <nav
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-normal md:justify-center md:gap-x-5"
                  aria-label="Alt bağlantılar"
                >
                  <button
                    type="button"
                    className="footer-link-btn"
                    onClick={() => setFooterInfoOpen("about")}
                  >
                    Hakkında
                  </button>
                  <span className="text-[color:rgba(240,241,244,0.25)]" aria-hidden>
                    ·
                  </span>
                  <button
                    type="button"
                    className="footer-link-btn"
                    onClick={() => setFooterInfoOpen("rules")}
                  >
                    Kurallar
                  </button>
                  <span className="text-[color:rgba(240,241,244,0.25)]" aria-hidden>
                    ·
                  </span>
                  <button
                    type="button"
                    className="footer-link-btn"
                    onClick={() => setFooterInfoOpen("privacy")}
                  >
                    Gizlilik
                  </button>
                  <span className="text-[color:rgba(240,241,244,0.25)]" aria-hidden>
                    ·
                  </span>
                  <button
                    type="button"
                    className="footer-link-btn"
                    onClick={() => setFooterInfoOpen("contact")}
                  >
                    İletişim
                  </button>
                  <span className="text-[color:rgba(240,241,244,0.25)]" aria-hidden>
                    ·
                  </span>
                  <a
                    href="https://x.com/61Larus"
                    className="footer-link-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    X
                  </a>
                  <span className="text-[color:rgba(240,241,244,0.25)]" aria-hidden>
                    ·
                  </span>
                  <a
                    href="https://www.instagram.com/61aktif/"
                    className="footer-link-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Instagram
                  </a>
                  <span className="text-[color:rgba(240,241,244,0.25)]" aria-hidden>
                    ·
                  </span>
                  <a
                    href="https://www.facebook.com/profile.php?id=61586158055479"
                    className="footer-link-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Facebook
                  </a>
                </nav>
                <p className="m-0 text-[10.5px] font-normal tabular-nums leading-none text-[color:var(--footer-link)] opacity-90 md:text-right md:text-[11px]">
                  © {new Date().getFullYear()}{" "}
                  <button
                    type="button"
                    onClick={goToBrandHome}
                    className="inline cursor-pointer border-0 bg-transparent p-0 font-inherit text-inherit align-baseline transition-opacity duration-200 hover:opacity-100"
                    aria-label="Ana sayfa — Akış"
                  >
                    61Larus
                  </button>
                </p>
              </div>
            </footer>
          </>
        )}
      </section>

      {renderFooterInfoPanel()}

    </main>
  );
}
