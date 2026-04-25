"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
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

/** Demo/seed or non-UUID ids: never call Supabase for comments tied to these rows. */
function isSeedId(value: string) {
  return value.startsWith("seed-") || !isRealUuid(value);
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
  /** `app/[slug]`: açılacak entry id (path ile eşleşen). */
  initialOpenEntryIdFromPath?: string | null;
  /** `app/[slug]`: bu segment canonical URL; kapatınca `/` */
  pathCanonicalSlug?: string | null;
};

type Props = HomePageClientProps;

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleString("tr-TR");
}

/** Entry detail header only: calendar date, Turkish long month, no time. */
function formatEntryDetailDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

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

function entryPublicUrl(entryId: string, slug?: string | null): string {
  if (typeof window === "undefined") return "";
  const origin = window.location.origin;
  const s = typeof slug === "string" ? slug.trim() : "";
  if (s.length > 0) {
    return `${origin}/${encodeURI(s)}`;
  }
  return `${origin}/?entry=${encodeURIComponent(entryId)}`;
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
  initialOpenEntryIdFromPath = null,
  pathCanonicalSlug = null,
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
  const openEntryNavRef = useRef(false);
  const openEntryNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entriesByIdRef = useRef<EntryItem[]>([]);
  entriesByIdRef.current = [
    ...centerEntries,
    ...leftEntries,
    ...rightEntries,
  ];

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
  const commentComposeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingFocusAfterEntrySelectRef = useRef(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
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

  // Stable callback + refs for gate flags so post-onboarding code can call this in the
  // same tick as setOnboardingDone without a stale closure (same mutations as a click).
  const selectEntry = useCallback((id: string) => {
    openEntryNavRef.current = true;
    if (openEntryNavTimerRef.current) clearTimeout(openEntryNavTimerRef.current);
    openEntryNavTimerRef.current = setTimeout(() => {
      openEntryNavRef.current = false;
    }, 600);
    // Source of truth: persist immediately on every entry click so pending survives
    // auth redirect, router.refresh, and re-renders until successful open clears it.
    writePendingReturn(id, "comment");
    setSelectedEntryId(id);
    const item = entriesByIdRef.current.find((e) => e.id === id);
    const slug = item?.slug?.trim() ?? "";
    const nextPath =
      slug.length > 0
        ? `/${encodeURI(slug)}`
        : `/?entry=${encodeURIComponent(id)}`;
    if (typeof window !== "undefined") {
      const nextUrl = new URL(nextPath, window.location.origin);
      const cur = `${window.location.pathname}${window.location.search}`;
      const n = `${nextUrl.pathname}${nextUrl.search}`;
      if (cur !== n) {
        void routerRef.current.replace(nextPath, { scroll: false });
      }
    } else {
      void routerRef.current.replace(nextPath, { scroll: false });
    }
    if (!isAuthenticatedRef.current) {
      setCenterMode("auth");
      return;
    }
    if (platformAccessSuspendedRef.current) {
      setCenterMode("feed");
      if (readPendingFromStorage().entryId === id) {
        clearPendingReturn();
      }
      return;
    }
    if (!agreementDoneRef.current) {
      setCenterMode("agreement");
      return;
    }
    setCenterMode("feed");
    if (readPendingFromStorage().entryId === id) {
      clearPendingReturn();
    }
  }, []);

  const closeEntryModal = useCallback(() => {
    openEntryNavRef.current = false;
    if (openEntryNavTimerRef.current) {
      clearTimeout(openEntryNavTimerRef.current);
      openEntryNavTimerRef.current = null;
    }
    clearPendingReturn();
    setSelectedEntryId(null);
    setCenterMode("feed");
    if (pathCanonicalSlug) {
      void routerRef.current.replace("/", { scroll: false });
    } else {
      stripEntryQueryFromUrl();
    }
  }, [pathCanonicalSlug, stripEntryQueryFromUrl]);

  /** Tam yazı akışı: arama kapalı, detay kapalı, feed modu. */
  const resetToWritingsFeed = useCallback(() => {
    setSearchQuery("");
    closeEntryModal();
  }, [closeEntryModal]);

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
    } else if (pathCanonicalSlug && initialOpenEntryIdFromPath) {
      writePendingReturn(initialOpenEntryIdFromPath, "comment");
    }
  }, [searchParams, pathCanonicalSlug, initialOpenEntryIdFromPath]);

  /** OAuth dönüşünde entry modalı açma; pending + URL temizliği, ana akışta kal. */
  useEffect(() => {
    if (!isOAuthReturnQuery(searchParams)) return;
    openEntryNavRef.current = false;
    if (openEntryNavTimerRef.current) {
      clearTimeout(openEntryNavTimerRef.current);
      openEntryNavTimerRef.current = null;
    }
    clearPendingReturn();
    setSelectedEntryId(null);
    setCenterMode("feed");
    void routerRef.current.replace("/", { scroll: false });
  }, [searchParams]);

  /**
   * ?entry= veya [slug] yokken entry modalı açma. Tıkla→replace tamamlanırken
   * openEntryNavRef kısa süre temizliği erteler; auth/ agreement moduna dokunmaz.
   */
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (isOAuthReturnQuery(searchParams)) return;
    if (pathCanonicalSlug && initialOpenEntryIdFromPath) return;
    if (window.location.search.includes("entry=")) return;
    if (openEntryNavRef.current) return;
    clearPendingReturn();
    setSelectedEntryId(null);
  }, [searchParams, pathCanonicalSlug, initialOpenEntryIdFromPath]);

  /** Yalnızca ?entry= veya /[slug] ile URL güdümlü; localStorage ile otomatik açma yok. */
  useEffect(() => {
    if (isOAuthReturnQuery(searchParams)) return;

    const raw = searchParams.get("entry");
    const urlEntryId =
      raw && isRealUuid(decodeURIComponent(raw.trim()))
        ? decodeURIComponent(raw.trim())
        : null;
    const pathEntryId =
      pathCanonicalSlug && initialOpenEntryIdFromPath
        ? initialOpenEntryIdFromPath
        : null;
    const entryId = urlEntryId ?? pathEntryId;
    if (!entryId) return;

    if (!isAuthenticated || !agreementDone || platformAccessSuspended) return;

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
    platformAccessSuspended,
    centerMode,
    centerEntries,
    leftEntries,
    rightEntries,
    selectEntry,
    searchParams,
    stripEntryQueryFromUrl,
    pathCanonicalSlug,
    initialOpenEntryIdFromPath,
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
      const raw = searchParams.get("entry");
      const urlEntryId =
        raw && isRealUuid(decodeURIComponent(raw.trim()))
          ? decodeURIComponent(raw.trim())
          : null;
      const pathId =
        pathCanonicalSlug && initialOpenEntryIdFromPath
          ? initialOpenEntryIdFromPath
          : null;
      if (urlEntryId || pathId) {
        selectEntry((urlEntryId ?? pathId) as string);
      } else {
        setCenterMode("feed");
      }
    }
  }, [
    isAuthenticated,
    agreementDone,
    platformAccessSuspended,
    centerMode,
    selectEntry,
    searchParams,
    pathCanonicalSlug,
    initialOpenEntryIdFromPath,
  ]);

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
      return;
    }
    if (platformAccessSuspendedRef.current) {
      return;
    }
    if (!agreementDoneRef.current) {
      setCenterMode("agreement");
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

    if (platformAccessSuspendedRef.current) {
      return;
    }
    if (!agreementDoneRef.current) {
      setCenterMode("agreement");
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

      const { error } = await supabase
        .from("comments")
        .insert({
          entry_id: selectedEntry.id,
          user_id: user.id,
          content: trimmed.slice(0, 161),
          parent_comment_id: null,
          reply_to_user_id: null,
          reply_to_username: null,
        });

      if (error) {
        console.error("COMMENT SUBMIT ERROR", error);
        return;
      }

      setCommentText("");
      await router.refresh();
    } catch (error) {
      console.error("COMMENT SUBMIT ERROR", error);
    } finally {
      setIsSubmittingComment(false);
    }
  }

  const mostCommentedEntries = useMemo(() => {
    const ranked = centerEntries.map((entry) => ({
      entry,
      commentCount: commentsByEntryIdLive[entry.id]?.length ?? 0,
    }));
    ranked.sort((a, b) => b.commentCount - a.commentCount);
    return ranked.slice(0, 10).map((row) => row.entry);
  }, [centerEntries, commentsByEntryIdLive]);

  const shuffledMainFeedEntries = useMemo(
    () => [...centerEntries].sort(compareEntriesByNewest),
    [centerEntries]
  );

  const rightRailAwaitingFirstComment = useMemo(() => {
    const withCounts = centerEntries.map((entry) => ({
      entry,
      commentCount: commentsByEntryIdLive[entry.id]?.length ?? 0,
    }));
    const zeros = withCounts.filter((r) => r.commentCount === 0);
    zeros.sort((a, b) => {
      const ta = new Date(a.entry.created_at).getTime();
      const tb = new Date(b.entry.created_at).getTime();
      return tb - ta;
    });
    return zeros.slice(0, 12).map((r) => r.entry);
  }, [centerEntries, commentsByEntryIdLive]);

  const waitingEntriesForExplore = useMemo(
    () => rightRailAwaitingFirstComment.slice(0, 4),
    [rightRailAwaitingFirstComment]
  );

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
    const encyclopedic = withMeta
      .filter((w) => isStarterEncyclopediaEntry(w.entry))
      .sort(sortByEngagement);
    const picked: EntryItem[] = [];
    const used = new Set<string>();
    for (const w of encyclopedic) {
      if (picked.length >= 4) break;
      picked.push(w.entry);
      used.add(w.entry.id);
    }
    if (picked.length < 4) {
      const rest = withMeta
        .filter((w) => !used.has(w.entry.id))
        .sort(sortByEngagement);
      for (const w of rest) {
        if (picked.length >= 4) break;
        picked.push(w.entry);
      }
    }
    return picked;
  }, [centerEntries, commentsByEntryIdLive]);

  const dailyQuestionEntry = useMemo((): EntryItem | null => {
    if (centerEntries.length === 0) return null;
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
    const withQuestionMark = withMeta.filter((w) =>
      w.entry.title.includes("?")
    );
    if (withQuestionMark.length > 0) {
      withQuestionMark.sort(sortByEngagement);
      return withQuestionMark[0].entry;
    }
    const gundem = withMeta.filter(
      (w) => normalizeEntryCategory(w.entry.category) === "gundem"
    );
    if (gundem.length > 0) {
      gundem.sort(sortByEngagement);
      return gundem[0].entry;
    }
    const sorted = [...withMeta].sort(sortByEngagement);
    return sorted[0].entry;
  }, [centerEntries, commentsByEntryIdLive]);

  const hasHomeExplore =
    starterEntries.length > 0 ||
    waitingEntriesForExplore.length > 0 ||
    dailyQuestionEntry !== null;

  /** Manifesto / ana grid arası: en çok yorum → eşitlikte yeni; en fazla 5. */
  const todayDiscoveryEntries = useMemo(() => {
    const ranked = centerEntries.map((entry) => ({
      entry,
      commentCount: commentsByEntryIdLive[entry.id]?.length ?? 0,
    }));
    ranked.sort((a, b) => {
      if (b.commentCount !== a.commentCount) {
        return b.commentCount - a.commentCount;
      }
      return compareEntriesByNewest(a.entry, b.entry);
    });
    return ranked.slice(0, 5).map((r) => r.entry);
  }, [centerEntries, commentsByEntryIdLive]);

  const focusCommentCompose = useCallback(() => {
    window.setTimeout(() => {
      const el = commentComposeTextareaRef.current;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        el.focus();
      }
    }, 80);
  }, []);

  useEffect(() => {
    if (!pendingFocusAfterEntrySelectRef.current) return;
    if (!selectedEntryId || centerMode !== "feed") {
      if (!selectedEntryId) {
        pendingFocusAfterEntrySelectRef.current = false;
      }
      return;
    }
    const t = window.setTimeout(() => {
      const el = commentComposeTextareaRef.current;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        el.focus();
      }
      pendingFocusAfterEntrySelectRef.current = false;
    }, 120);
    return () => {
      window.clearTimeout(t);
    };
  }, [selectedEntryId, centerMode]);

  const feedEntriesSearchFiltered = useMemo(() => {
    let list = shuffledMainFeedEntries;
    if (searchQuery.trim()) {
      list = list.filter((e) => entryMatchesSearch(e, searchQuery));
    }
    return list;
  }, [shuffledMainFeedEntries, searchQuery]);

  const centerFeedEntries = useMemo(
    () => feedEntriesSearchFiltered.slice(0, feedVisibleCount),
    [feedEntriesSearchFiltered, feedVisibleCount]
  );

  const feedHasMore = feedVisibleCount < feedEntriesSearchFiltered.length;

  const copyEntryLink = (entryId: string, title: string, slug?: string | null) => {
    const url = entryPublicUrl(entryId, slug);
    void navigator.clipboard.writeText(`${title}\n${url}`);
  };

  const shareWhatsApp = (entryId: string, title: string, slug?: string | null) => {
    const link = entryPublicUrl(entryId, slug);
    const text = encodeURIComponent(`${title} ${link}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const shareX = (entryId: string, title: string, slug?: string | null) => {
    const link = entryPublicUrl(entryId, slug);
    const text = encodeURIComponent(title);
    const url = encodeURIComponent(link);
    window.open(
      `https://x.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

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
    const pathId =
      pathCanonicalSlug && initialOpenEntryIdFromPath
        ? initialOpenEntryIdFromPath
        : null;
    if (urlEntryId || pathId) {
      selectEntry((urlEntryId ?? pathId) as string);
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
        <div className="feed-index-empty-message flex min-h-[160px] items-center justify-center border-t border-dashed border-[color:var(--divide-hair)] px-4 py-14 text-center">
          Henüz içerik yok
        </div>
      );
    }
    if (feedEntriesSearchFiltered.length === 0) {
      const hasSearch = searchQuery.trim().length > 0;
      return (
        <div className="feed-search-empty border-t border-[color:var(--divide-hair)] px-4 py-16 text-center md:px-6 md:py-20">
          <p className="feed-search-empty-title m-0">
            {hasSearch
              ? "Aramana uygun madde yok."
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
        <nav className="flex flex-col" aria-label="Hafızaya eklenen maddeler">
          {centerFeedEntries.map((entry) => {
            const cc = commentsByEntryIdLive[entry.id]?.length ?? 0;
            const isActive = entry.id === effectiveEntryId;
            return (
              <FeedEntryCard
                key={entry.id}
                title={entry.title}
                contentPreview={entry.content}
                commentCount={cc}
                authorLabel={entry.authorName?.trim() || "61Larus"}
                metaDate={formatFeedLineDate(entry.created_at)}
                createdAtRaw={entry.created_at}
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
            className="feed-load-more mt-6 w-full min-h-[3rem] border-0 bg-transparent py-3 text-center underline decoration-[color:var(--divide-muted)] decoration-1 underline-offset-[5px] transition-colors hover:text-[color:var(--text-primary)] hover:decoration-[color:var(--border-subtle)] md:mt-8 md:min-h-0 md:py-4"
          >
            Daha fazla yazı yükle ↓
          </button>
        ) : null}
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

    const authorName = selectedEntry.authorName?.trim() || "61Larus";
    const formattedDate = formatEntryDetailDate(selectedEntry.created_at);

    return (
      <div className="relative z-0 max-w-none">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <button
            type="button"
            onClick={() => closeEntryModal()}
            className="entry-detail-back"
          >
            ← akışa dön
          </button>
        </div>

        <article className="entry-detail-article m-0 border-0 p-0">
          <header className="m-0 border-0 p-0">
            <h1 id="entry-detail-title" className="entry-detail-title">
              {selectedEntry.title}
            </h1>
            <div className="entry-meta">
              <span className="entry-author">{authorName}</span>
              <span className="entry-dot" aria-hidden>
                •
              </span>
              <span className="entry-date">{formattedDate}</span>
            </div>
          </header>
          <section
            aria-labelledby="entry-detail-title"
            className="m-0 border-0 p-0"
          >
            <p className="entry-detail-body">{selectedEntry.content}</p>
          </section>
        </article>

        <div className="entry-share-row">
          <button
            type="button"
            onClick={() =>
              copyEntryLink(
                selectedEntry.id,
                selectedEntry.title,
                selectedEntry.slug
              )
            }
            className="entry-share-btn"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.15}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>kopyala</span>
          </button>
          <button
            type="button"
            onClick={() =>
              shareWhatsApp(
                selectedEntry.id,
                selectedEntry.title,
                selectedEntry.slug
              )
            }
            className="entry-share-btn"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.15}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>whatsapp</span>
          </button>
          <button
            type="button"
            onClick={() =>
              shareX(
                selectedEntry.id,
                selectedEntry.title,
                selectedEntry.slug
              )
            }
            className="entry-share-btn"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.15}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>x</span>
          </button>
        </div>

        <section className="entry-comments-section" aria-label="Yorumlar">
          {selectedComments.length === 0 ? (
            <div className="entry-comments-empty">ilk yorumu sen yaz</div>
          ) : (
            <div className="flex flex-col">
              {selectedComments.map((comment, index) => (
                <div
                  key={comment.id}
                  className={`entry-comment-item${index > 0 ? " entry-comment-item--follows" : ""}`}
                >
                  <p className="entry-comment-author">{comment.authorLabel}</p>
                  {comment.bio61?.trim() ? (
                    <p className="entry-comment-bio">{comment.bio61.trim()}</p>
                  ) : null}
                  <p className="entry-comment-text">{comment.content}</p>
                  <div className="entry-comment-meta">
                    <time dateTime={comment.created_at}>
                      {formatDate(comment.created_at)}
                    </time>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="entry-comment-compose-wrap">
          <div className="entry-comment-compose">
            <textarea
              ref={commentComposeTextareaRef}
              placeholder="sen ne düşünüyorsun?"
              maxLength={161}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value.slice(0, 161))}
              onFocus={() => {
                void requireAuthForComment();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submitComment();
                }
              }}
              disabled={platformAccessSuspended}
              className="entry-comment-textarea"
            />
            <div className="entry-comment-actions">
              <button
                type="button"
                disabled={isSubmittingComment || platformAccessSuspended}
                onClick={() => void submitComment()}
                className="entry-comment-submit"
              >
                gönder
              </button>
            </div>
          </div>
        </div>
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
        <div className="headerBlock">
          <div className="headerBar min-w-0">
            <div className="flex min-w-0 flex-col gap-1 lg:max-w-[min(21rem,100%)]">
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
          <div className="headerUserName site-header-aux min-w-0 gap-x-3 sm:gap-x-4 lg:shrink-0 lg:gap-x-5 lg:pr-6">
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
            : "relative z-0 flex w-full flex-col border-y border-[color:var(--divide-hair)] bg-[var(--bg-primary)]"
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
            <div className="home-page-editorial">
            <div className="home-manifesto home-manifesto--bridge home-search-bridge">
              <div className="home-manifesto-inner home-manifesto-inner--bridge home-search-field">
                <div className="home-manifesto-search">
                  <label
                    htmlFor="feed-search-input"
                    className="home-manifesto-utility home-manifesto-utility--search m-0"
                  >
                    Yazılarda ara
                  </label>
                  <input
                    id="feed-search-input"
                    name="q"
                    type="search"
                    className="home-manifesto-input home-manifesto-input--premium"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Başlık ara…"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>
            {todayDiscoveryEntries.length > 0 ? (
              <section
                className="today-discovery today-discovery--vitrin"
                aria-labelledby="today-discovery-title"
              >
                <div className="today-discovery-head">
                  <h2
                    id="today-discovery-title"
                    className="today-discovery-kicker m-0"
                  >
                    Bugün 61Larus’ta
                  </h2>
                  <p className="today-discovery-copy m-0">
                    Yeni eklenenlerden, çok konuşulanlara; Trabzon’un
                    hafızasında kısa bir tur.
                  </p>
                </div>
                <div
                  className="today-discovery-grid"
                  role="list"
                  aria-label="Bugün vurgulanan maddeler"
                >
                  {todayDiscoveryEntries.map((entry, index) => {
                    const cc = commentsByEntryIdLive[entry.id]?.length ?? 0;
                    const num = String(index + 1).padStart(2, "0");
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        role="listitem"
                        className="today-discovery-item"
                        onClick={() => selectEntry(entry.id)}
                        aria-label={`Aç: ${entry.title}`}
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
                        <span className="today-discovery-meta">
                          {cc > 0 ? `${cc} yorum` : "Yeni madde"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}
            <div className="home-main-columns-wrap min-h-0 w-full min-w-0 max-w-full">
            <div className="home-editorial-cols home-content-grid home-content-grid--editorial home-content-grid--flow home-content-grid--faz3 flex w-full min-h-0 min-w-0 max-w-full flex-col gap-0 md:grid md:grid-cols-[minmax(11rem,0.95fr)_minmax(12rem,1fr)_minmax(0,2.5fr)] md:items-stretch md:gap-0 md:min-h-0 lg:grid-cols-[minmax(11.5rem,1fr)_minmax(12.5rem,1.05fr)_minmax(0,2.6fr)]">
            <aside
              className="home-rail home-rail--awaiting home-rail--editorial-col home-rail--column await-col flex max-h-[42vh] w-full min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-b border-[color:var(--editorial-hairline)] bg-transparent md:max-h-none md:w-full md:max-w-none md:overflow-hidden md:border-b-0 md:border-r md:border-[color:var(--editorial-hairline)]"
              aria-label="Yazılmayı bekleyenler"
            >
              <div className="col-section-head col-head-band home-rail-header home-rail-header--col shrink-0 px-3.5 md:px-4">
                <p className="col-section-head__kicker">BEKLEYEN BAŞLIKLAR</p>
                <h2 className="col-section-head__title m-0">
                  Yazılmayı bekleyenler
                </h2>
                <p className="col-section-head__micro m-0">
                  Henüz yorum yok; ilk notu bırak.
                </p>
              </div>
              <div className="home-rail-body home-rail-body--awaiting col-list-panel left-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <nav
                  className="home-rail-nav home-rail-nav--awaiting flex flex-col px-2.5 pb-4 md:px-3.5 md:pb-5"
                  aria-label="Henüz yorum almamış başlıklar"
                >
                  {rightRailAwaitingFirstComment.map((entry, index) => {
                    const isActive = entry.id === effectiveEntryId;
                    const rank = index + 1;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => selectEntry(entry.id)}
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
              className="home-rail home-rail--trending home-rail--editorial-col home-rail--column flex max-h-[40vh] w-full min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-b border-[color:var(--editorial-hairline)] bg-transparent md:max-h-none md:w-full md:max-w-none md:overflow-hidden md:border-b-0 md:border-r md:border-[color:var(--editorial-hairline)]"
              aria-label="Şu an en çok konuşulanlar"
            >
              <div className="col-section-head col-head-band col-head-band--trending home-rail-header home-rail-header--col shrink-0 px-3.5 md:px-4">
                <p className="col-section-head__kicker">GÜNDEMİN NABZI</p>
                <h2 className="col-section-head__title m-0">
                  Şu an en çok konuşulanlar
                </h2>
                <p className="col-section-head__micro m-0">
                  Yorum alan başlıklar öne çıkar.
                </p>
              </div>
              <div className="home-rail-body home-rail-body--trending col-list-panel left-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <nav
                  className="home-rail-nav flex flex-col px-2.5 pb-4 md:px-3.5 md:pb-5"
                  aria-label="En çok yorumlananlar"
                >
                  {mostCommentedEntries.map((entry, index) => {
                    const cc = commentsByEntryIdLive[entry.id]?.length ?? 0;
                    const isActive = entry.id === effectiveEntryId;
                    const rank = index + 1;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => selectEntry(entry.id)}
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
            <main className="main-column home-rail--center home-rail--editorial-col home-rail--feed-main feed-col flex min-h-0 min-w-0 w-full flex-col bg-transparent md:h-full md:border-l md:border-[color:var(--editorial-hairline)]">
              <div className="home-feed-rail layout-feed-inner layout-feed-inner--post-manifesto mx-auto flex w-full min-h-0 min-w-0 max-w-none flex-1 flex-col px-4 py-5 sm:px-5 sm:py-6 md:h-full md:min-h-0 md:px-7 md:py-0 lg:px-9">
                <div className="col-section-head col-head-band col-head-band--feed home-feed-rail__head home-rail-header--col shrink-0">
                  <p className="col-section-head__kicker">YENİ EKLENENLER</p>
                  <h2
                    className="col-section-head__title m-0"
                    id="main-feed-title"
                  >
                    Hafızaya eklenenler
                  </h2>
                  <p className="col-section-head__micro m-0">
                    Son eklenen maddeler burada akar.
                  </p>
                </div>
                <div className="home-feed-rail__body home-rail-body home-rail-body--feed col-list-panel left-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 md:min-h-0 md:pb-3">
                  {renderMainFeed()}
                </div>
              </div>
            </main>
            </div>
            </div>

            {hasHomeExplore ? (
              <section
                className="home-explore home-explore--prefooter home-explore--after-main-columns"
                aria-labelledby="home-explore-title"
              >
                  <header className="col-section-head col-explore-section-head home-explore-head home-explore-head--section-start">
                    <p className="col-section-head__kicker">KEŞİF</p>
                    <h2
                      id="home-explore-title"
                      className="col-section-head__title m-0"
                    >
                      Trabzon&apos;u keşfetmeye devam et
                    </h2>
                    <p className="home-explore-copy m-0">
                      61Larus&apos;ta her başlık bir kapı açar; tarihten
                      mahallelere, gündemden sofraya.
                    </p>
                  </header>
                  <div className="home-explore-grid">
                    {starterEntries.length > 0 ? (
                      <div className="home-explore-panel home-explore-panel--starter">
                        <header className="col-section-head home-explore-panel-head">
                          <h3 className="col-section-head__kicker m-0">
                            TRABZON&apos;U ANLAMAK İÇİN BAŞLA
                          </h3>
                        </header>
                        <ul className="home-explore-list" role="list">
                          {starterEntries.map((entry) => {
                            const cc =
                              commentsByEntryIdLive[entry.id]?.length ?? 0;
                            return (
                              <li key={entry.id}>
                                <button
                                  type="button"
                                  className="home-explore-item"
                                  onClick={() => selectEntry(entry.id)}
                                  aria-label={`Aç: ${entry.title}`}
                                >
                                  <span className="home-explore-item-title">
                                    {entry.title}
                                  </span>
                                  <span className="home-explore-item-meta">
                                    {cc > 0
                                      ? `${cc} yorum`
                                      : "Yeni madde"}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                    {waitingEntriesForExplore.length > 0 ? (
                      <div className="home-explore-panel home-explore-panel--waiting">
                        <header className="col-section-head home-explore-panel-head">
                          <h3 className="col-section-head__kicker m-0">
                            YAZILMAYI BEKLEYENLER
                          </h3>
                        </header>
                        <ul className="home-explore-list" role="list">
                          {waitingEntriesForExplore.map((entry) => (
                            <li key={entry.id}>
                              <button
                                type="button"
                                className="home-explore-item"
                                onClick={() => selectEntry(entry.id)}
                                aria-label={`Aç: ${entry.title}`}
                              >
                                <span className="home-explore-item-title">
                                  {entry.title}
                                </span>
                                <span className="home-explore-item-meta">
                                  0 yorum
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {dailyQuestionEntry ? (
                      <div className="home-explore-panel home-explore-panel--question">
                        <header className="col-section-head home-explore-panel-head">
                          <h3 className="col-section-head__kicker m-0">
                            GÜNÜN SORUSU
                          </h3>
                        </header>
                        <button
                          type="button"
                          className="home-explore-question"
                          onClick={() =>
                            selectEntry(dailyQuestionEntry.id)
                          }
                          aria-label={`Aç: ${dailyQuestionEntry.title}`}
                        >
                          <span className="home-explore-item-title">
                            {dailyQuestionEntry.title}
                          </span>
                          <span className="home-explore-item-meta">
                            {(commentsByEntryIdLive[
                              dailyQuestionEntry.id
                            ]?.length ?? 0) > 0
                              ? `${commentsByEntryIdLive[dailyQuestionEntry.id]?.length ?? 0} yorum`
                              : "Yeni madde"}
                          </span>
                          <span className="home-explore-cta">
                            Maddeyi aç →
                          </span>
                        </button>
                      </div>
                    ) : null}
                  </div>
              </section>
            ) : null}
            </div>

            <footer
              id="site-footer"
              className="site-footer home-page-footer home-page-footer--after-explore px-5 md:px-10"
            >
              <div className="mx-auto flex max-w-[80rem] flex-col gap-7 md:flex-row md:items-baseline md:justify-between md:gap-8">
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

      {selectedEntryId && centerMode === "feed" ? (
        <div
          className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-[color:var(--overlay-scrim)] px-3 py-5 backdrop-blur-[1px] md:items-center md:py-8"
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

      {renderFooterInfoPanel()}

    </main>
  );
}
