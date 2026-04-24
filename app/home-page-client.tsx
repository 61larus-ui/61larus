"use client";

import {
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
import {
  FEED_CATEGORY_OPTIONS,
  normalizeEntryCategory,
  type FeedCategoryFilter,
} from "@/lib/entry-category";
import { FeedEntryCard } from "./feed-entry-card";

/** DB’de kategori ya label (\"Yerel lezzetler\") ya da slug (yerel-lezzetler) olabilir. */
function dbCategoryValuesForFilter(selectedCategory: FeedCategoryFilter): string[] {
  if (selectedCategory === "all" || (selectedCategory as string) === "tumu")
    return [];
  const opt = FEED_CATEGORY_OPTIONS.find((o) => o.id === selectedCategory);
  if (!opt || opt.id === "all") return [];
  const out = [opt.id, opt.label];
  if (opt.id === "tarih") {
    return [...new Set([...out, "Tarih"])];
  }
  return out;
}

/** Sağ kolon kategori rayı — ince çizgi, tek görsel dil (referans). */
function categoryRailIcon(id: FeedCategoryFilter): ReactNode {
  const t = {
    stroke: "currentColor" as const,
    strokeWidth: 1.05,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const box = "category-rail-svg block h-[1.05rem] w-[1.05rem] shrink-0";
  switch (id) {
    case "all":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={box}>
          <path {...t} d="M5 8.5h14M5 12h14M5 15.5h9.5" />
        </svg>
      );
    case "gundem":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={box}>
          <path
            {...t}
            d="M8.5 4.5h8a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z"
          />
          <path {...t} d="M8 9.5h8M8 12.5h6.5M8 15.5h7.5" />
        </svg>
      );
    case "sahsiyetler":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={box}>
          <circle {...t} cx="12" cy="8.25" r="3.15" />
          <path {...t} d="M6.25 19.25v-.75a5.75 5.75 0 0 1 11.5 0v.75" />
        </svg>
      );
    case "mahalleler":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={box}>
          <path
            {...t}
            d="M4.5 10.25 12 4.75l7.5 5.5V19a1 1 0 0 1-1 1h-4.75v-6.5h-3.5V20H5.5a1 1 0 0 1-1-1v-8.75Z"
          />
        </svg>
      );
    case "sehir-hafizasi":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={box}>
          <path {...t} d="M5.5 5.5h6v13h-6V5.5Z" />
          <path {...t} d="M13.5 8.5h5v10h-5V8.5Z" />
          <path {...t} d="M8 9.5h2M8 12h2M16 11.5h1.5M16 14h1.5" />
        </svg>
      );
    case "gundelik-hayat":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={box}>
          <path
            {...t}
            d="M8.5 4.5h8a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z"
          />
          <path {...t} d="M8 9.5h8M8 12.5h6.5M8 15.5h7.5" />
        </svg>
      );
    case "tarih":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={box}>
          <path {...t} d="M5 20V11l7-4.25L19 11v9" />
          <path {...t} d="M5 20h14" />
          <path {...t} d="M10 20v-4.5h4V20" />
          <path {...t} d="M9 11.5h6" />
        </svg>
      );
    case "yerel-lezzetler":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={box}>
          <ellipse {...t} cx="12" cy="16" rx="7" ry="2.25" />
          <path
            {...t}
            d="M6.2 10.2c1.1 1.8 2.1 1.8 2.8 0M10.4 8.2c.9 1.6 1.7 1.6 2.2 0M13.4 6.2c.8 1.2 1.4 1.2 1.8 0"
          />
          <path {...t} d="M8.5 14.5h7" />
        </svg>
      );
    case "cografya":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={box}>
          <path {...t} d="M4 18.5h16" />
          <path {...t} d="m5.5 18.5 4.25-9 3.5 6 3.75-11L18.5 18.5" />
        </svg>
      );
    case "yurttaslik-bilgisi":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={box}>
          <path {...t} d="M4 8h16" />
          <path {...t} d="M12 5.5V19" />
          <path {...t} d="M8 19h8" />
          <path {...t} d="M8.5 8 6 14.5h5L8.5 8Z" />
          <path {...t} d="M15.5 8 13 14.5h5l-2.5-6.5Z" />
        </svg>
      );
    case "spor":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className={box}>
          <circle {...t} cx="12" cy="12" r="6.35" />
          <path {...t} d="M12 5.65v12.7M5.65 12h12.7" />
          <path
            {...t}
            d="M7.35 7.35c1.85 1.85 7.45 1.85 9.3 0M7.35 16.65c1.85-1.85 7.45-1.85 9.3 0"
          />
        </svg>
      );
  }
}

function entryCategoryEyebrow(category: string | null | undefined): string {
  const slug = normalizeEntryCategory(category ?? null);
  if (!slug) return "YAZI";
  const opt = FEED_CATEGORY_OPTIONS.find((o) => o.id === slug);
  return (opt?.label ?? "Yazı").toLocaleUpperCase("tr-TR");
}

function entryMatchesSearch(entry: EntryItem, rawQuery: string): boolean {
  const q = rawQuery.trim();
  if (!q) return true;
  const ql = q.toLocaleLowerCase("tr-TR");
  const parts: string[] = [
    entry.title ?? "",
    entry.content ?? "",
    entry.authorName ?? "",
  ];
  const rawCat = entry.category?.trim();
  if (rawCat) parts.push(rawCat);
  const slug = normalizeEntryCategory(entry.category ?? null);
  if (slug) {
    const opt = FEED_CATEGORY_OPTIONS.find((o) => o.id === slug);
    if (opt) parts.push(opt.label);
  }
  return parts.some((s) => s.toLocaleLowerCase("tr-TR").includes(ql));
}

function estimateReadMinutesFromText(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
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
  category?: string | null;
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

export type CenterMode = "feed" | "entry" | "auth" | "agreement";

type FooterInfoId = "about" | "rules" | "privacy" | "contact";

type Props = {
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

function entryPublicUrl(entryId: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/?entry=${encodeURIComponent(entryId)}`;
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
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return readPendingFromStorage().entryId;
  });
  const [centerMode, setCenterMode] = useState<CenterMode>("feed");
  const [feedCategoryFilter, setFeedCategoryFilter] =
    useState<FeedCategoryFilter>("all");
  const [categoryFilteredEntries, setCategoryFilteredEntries] = useState<
    EntryItem[] | null
  >(null);
  const [feedVisibleCount, setFeedVisibleCount] = useState(FEED_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [headerEditorialIdx, setHeaderEditorialIdx] = useState(0);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
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
    // Source of truth: persist immediately on every entry click so pending survives
    // auth redirect, router.refresh, and re-renders until successful open clears it.
    writePendingReturn(id, "comment");
    setSelectedEntryId(id);
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
    clearPendingReturn();
    setSelectedEntryId(null);
    setCenterMode("feed");
    stripEntryQueryFromUrl();
  }, [stripEntryQueryFromUrl]);

  /** Tam yazı akışı: kategori tümü, arama kapalı, detay kapalı, feed modu. */
  const resetToWritingsFeed = useCallback(() => {
    setFeedCategoryFilter("all");
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
    if (!isAuthenticated || !agreementDone || platformAccessSuspended) return;

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
    platformAccessSuspended,
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
  }, [feedCategoryFilter, searchQuery]);

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
      const { entryId } = readPendingFromStorage();
      if (entryId) {
        selectEntry(entryId);
      } else {
        setCenterMode("feed");
      }
    }
  }, [
    isAuthenticated,
    agreementDone,
    platformAccessSuspended,
    centerMode,
    selectedEntryId,
    selectEntry,
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

  useEffect(() => {
    const isAll =
      feedCategoryFilter === "all" ||
      (feedCategoryFilter as string) === "tumu";
    if (isAll) {
      setCategoryFilteredEntries(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      let query = supabase
        .from("entries")
        .select("id, title, content, created_at, category, user_id")
        .order("created_at", { ascending: false });
      const vals = dbCategoryValuesForFilter(feedCategoryFilter);
      if (vals.length > 0) {
        query = query.in("category", vals);
      }
      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        console.error("[entries] category query", error);
        setCategoryFilteredEntries(null);
        return;
      }
      const rows = (data ?? []) as {
        id: string;
        title: string;
        content: string;
        created_at: string;
        category: string | null;
        user_id?: string | null;
      }[];
      const distinctCats = [
        ...new Set(
          rows.map((r) => (typeof r.category === "string" ? r.category : ""))
        ),
      ];
      console.log(
        "[entries fetch] selectedCategory:",
        feedCategoryFilter,
        "distinct category values in response:",
        distinctCats
      );
      setCategoryFilteredEntries(
        rows.map((r) => {
          const existing = centerEntries.find((e) => e.id === r.id);
          const rawCat = typeof r.category === "string" ? r.category : null;
          return {
            id: String(r.id),
            title: r.title,
            content: r.content,
            created_at: r.created_at,
            category: normalizeEntryCategory(rawCat) ?? rawCat,
            authorName: existing?.authorName ?? null,
            bio61: existing?.bio61 ?? null,
          };
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [feedCategoryFilter, centerEntries]);

  const feedEntriesFiltered = useMemo(() => {
    if (
      feedCategoryFilter === "all" ||
      (feedCategoryFilter as string) === "tumu"
    ) {
      return centerEntries;
    }
    if (categoryFilteredEntries !== null) {
      return categoryFilteredEntries;
    }
    return centerEntries.filter((e) => {
      const n = normalizeEntryCategory(e.category ?? null);
      return n === feedCategoryFilter;
    });
  }, [centerEntries, feedCategoryFilter, categoryFilteredEntries]);

  const feedEntriesSearchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return feedEntriesFiltered;
    return feedEntriesFiltered.filter((e) => entryMatchesSearch(e, searchQuery));
  }, [feedEntriesFiltered, searchQuery]);

  const centerFeedEntries = useMemo(
    () => feedEntriesSearchFiltered.slice(0, feedVisibleCount),
    [feedEntriesSearchFiltered, feedVisibleCount]
  );

  const feedHasMore = feedVisibleCount < feedEntriesSearchFiltered.length;

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
        <div className="flex min-h-[160px] items-center justify-center border-t border-dashed border-[color:var(--divide-hair)] px-4 py-14 text-center text-sm text-[color:var(--text-muted)]">
          Henüz içerik yok
        </div>
      );
    }
    if (feedEntriesFiltered.length === 0) {
      return (
        <div className="flex min-h-[160px] items-center justify-center border-t border-dashed border-[color:var(--divide-hair)] px-4 py-14 text-center text-sm text-[color:var(--text-muted)]">
          Bu kategoride entry yok.
        </div>
      );
    }
    if (feedEntriesSearchFiltered.length === 0 && searchQuery.trim()) {
      return (
        <div className="feed-search-empty border-t border-[color:var(--divide-hair)] px-4 py-16 text-center md:px-6 md:py-20">
          <p className="feed-search-empty-title m-0 text-[0.9375rem] font-normal leading-relaxed text-[color:var(--text-secondary)] md:text-[0.96875rem]">
            Aramana uygun bir yazı bulunamadı.
          </p>
          <p className="feed-search-empty-hint m-0 mt-3 max-w-[22rem] mx-auto text-[0.8125rem] font-normal leading-[1.65] text-[color:var(--text-muted)] md:text-[0.84375rem]">
            Farklı bir kelime deneyebilir veya kategori filtresini
            değiştirebilirsin.
          </p>
        </div>
      );
    }
    return (
      <div className="relative z-0 pb-5 md:pb-8">
        <nav className="flex flex-col" aria-label="Entry akışı">
          {centerFeedEntries.map((entry) => {
            const cc = commentsByEntryIdLive[entry.id]?.length ?? 0;
            const isActive = entry.id === effectiveEntryId;
            return (
              <FeedEntryCard
                key={entry.id}
                title={entry.title}
                contentPreview={entry.content}
                commentCount={cc}
                readMinutes={estimateReadMinutesFromText(entry.content)}
                categoryEyebrow={entryCategoryEyebrow(entry.category)}
                authorLabel={entry.authorName?.trim() || "61Larus"}
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
            className="mt-8 w-full border-0 bg-transparent py-4 text-center text-[12px] font-normal tracking-[0.03em] text-[color:var(--text-muted)] underline decoration-[color:var(--divide-muted)] decoration-1 underline-offset-[6px] transition-colors hover:text-[color:var(--text-secondary)] hover:decoration-[color:var(--border-subtle)]"
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
              copyEntryLink(selectedEntry.id, selectedEntry.title)
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
              shareWhatsApp(selectedEntry.id, selectedEntry.title)
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
            onClick={() => shareX(selectedEntry.id, selectedEntry.title)}
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
            <div className="site-info-contact-card" aria-label="İletişim">
              <p className="site-info-contact-label">Genel yazışma</p>
              <a
                className="site-info-contact-link"
                href="mailto:iletisim@61larus.com"
              >
                iletisim@61larus.com
              </a>
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
      <header className="site-header relative mb-7 shrink-0 border-b border-[color:var(--divide-hair)] pb-5 md:mb-8 md:pb-7">
        <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="flex min-w-0 flex-col gap-1 lg:max-w-[min(21rem,100%)]">
            <button
              type="button"
              onClick={goToBrandHome}
              className="site-wordmark max-w-full border-0 bg-transparent p-0 text-left transition-opacity duration-200 hover:opacity-88"
              style={{ fontFeatureSettings: '"ss01" 1, "cv01" 1' }}
              aria-label="Ana sayfa — Akış"
            >
              61Larus
            </button>
            <p className="site-header-tagline m-0">
              Trabzon’un gündemi, lafı ve hafızası
            </p>
          </div>
          <div
            className="site-header-editorial"
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
          <div className="site-header-aux flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-5 lg:w-auto lg:max-w-none lg:shrink-0 lg:justify-end">
            <div className="site-header-search min-w-0 flex-1 sm:flex-initial sm:max-w-[12.25rem] md:max-w-[13.25rem]">
              <label htmlFor="site-header-search-input" className="sr-only">
                Yazılarda ara
              </label>
              <span className="site-header-search-icon" aria-hidden>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.15}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="10.5" cy="10.5" r="5.75" />
                  <path d="m16.25 16.25 3.6 3.6" />
                </svg>
              </span>
              <input
                id="site-header-search-input"
                type="search"
                name="q"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Başlık ara"
                autoComplete="off"
                spellCheck={false}
                className="site-header-search-input"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="site-header-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Aramayı temizle"
                >
                  ×
                </button>
              ) : null}
            </div>
            {!isAuthenticated ? (
              <Link
                href="/auth"
                className="font-normal tracking-[0.04em] text-[color:var(--text-tertiary)] underline decoration-[color:var(--divide-muted)] decoration-1 underline-offset-[5px] transition-colors hover:text-[color:var(--text-secondary)]"
              >
                Giriş
              </Link>
            ) : null}
            {isAuthenticated ? (
              <>
                <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen((o) => !o);
                  }}
                  className="max-w-full border-0 bg-transparent p-0"
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                >
                  <div
                    className="account-menu-trigger-inner flex cursor-pointer items-center px-1 py-0.5 text-[color:var(--text-tertiary)] transition-colors duration-150 hover:text-[color:var(--text-secondary)]"
                    style={{ transition: "var(--transition)" }}
                  >
                    <span className="account-menu-handle">
                      {userEmail?.split("@")[0] || "kullanıcı"}
                    </span>
                  </div>
                </button>
                {accountMenuOpen ? (
                  <div className="account-menu-panel" role="menu">
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
                        Hesabımı sil
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
                </>
            ) : null}
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
            <div className="flex w-full min-w-0 flex-col gap-0 md:grid md:grid-cols-[minmax(10rem,0.88fr)_minmax(0,2.62fr)_minmax(11.25rem,0.86fr)] md:items-stretch md:gap-0 lg:grid-cols-[minmax(10.5rem,0.9fr)_minmax(0,2.68fr)_minmax(12rem,0.88fr)]">
            <aside
              className="flex max-h-[36vh] w-full min-w-0 shrink-0 flex-col overflow-hidden border-b border-[color:var(--divide-hair)] bg-transparent md:sticky md:top-4 md:z-[5] md:max-h-[calc(100dvh-6rem)] md:w-full md:max-w-none md:overflow-hidden md:self-start md:border-b-0 md:border-r md:border-[color:var(--divide-hair)]"
              aria-label="Şu an en çok konuşulanlar"
            >
              <div className="shrink-0 border-b border-[color:var(--divide-hair)] px-3.5 pb-3.5 pt-4 md:px-4 md:pb-4 md:pt-5">
                <p className="trending-rail-eyebrow mb-0">
                  Şu an en çok konuşulanlar
                </p>
              </div>
              <div
                className="left-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "var(--scrollbar-thumb) transparent",
                }}
              >
                <nav
                  className="flex flex-col px-2.5 pb-4 pt-2.5 md:px-3.5 md:pb-5 md:pt-3"
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
                        className={`group relative flex w-full items-start gap-3 border-0 border-b border-[color:var(--divide-hair)] py-3 pl-0.5 pr-1 text-left last:border-b-0 md:gap-3.5 md:py-3.5 md:pl-1 md:pr-1.5 ${
                          isActive
                            ? "bg-[var(--list-row-active)]"
                            : "bg-transparent hover:bg-[var(--surface-hover)]"
                        }`}
                      >
                        <span
                          className={`index-rank w-[1.35rem] shrink-0 pt-0.5 text-right md:w-6 ${
                            isActive
                              ? "text-[color:var(--accent-green)]"
                              : "text-[color:var(--text-tertiary)] group-hover:text-[color:var(--text-meta)]"
                          }`}
                          aria-hidden
                        >
                          {rank}.
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1 md:gap-1.5">
                          <span
                            className={`index-entry-title line-clamp-2 ${
                              isFirst || isActive
                                ? "index-entry-title--emph"
                                : "index-entry-title--quiet"
                            }`}
                          >
                            {entry.title}
                          </span>
                          <span className="index-entry-meta">{cc} yorum</span>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </aside>
            <main className="main-column relative min-w-0 w-full bg-transparent md:border-x md:border-[color:var(--divide-hair)]">
              <div className="layout-feed-inner mx-auto w-full max-w-none px-4 py-5 sm:px-5 sm:py-6 md:px-7 md:py-7 lg:px-9">
                {renderMainFeed()}
              </div>
            </main>
            <aside
              className="right-column flex w-full min-w-0 shrink-0 flex-col border-t border-[color:var(--divide-hair)] bg-transparent md:sticky md:top-4 md:z-[5] md:w-full md:max-w-none md:self-start md:border-l md:border-t-0 md:border-[color:var(--divide-hair)]"
              aria-label="Yayın paneli"
            >
              <div className="right-block flex flex-col px-3 pb-5 pt-3.5 md:px-4 md:pb-6 md:pt-4">
                <div className="pb-5 md:pb-5">
                  <p className="sidebar-block-title">Akış prensibi</p>
                  <ul className="sidebar-rail-copy m-0 list-none space-y-2.5 p-0 text-[color:var(--text-secondary)] md:space-y-3">
                    <li className="flex gap-2">
                      <span
                        className="mt-1.5 h-0.75 w-0.75 shrink-0 rounded-full bg-[color:var(--text-primary)] opacity-45"
                        aria-hidden
                      />
                      <span>Her yazı bir duruş.</span>
                    </li>
                    <li className="flex gap-2">
                      <span
                        className="mt-1.5 h-0.75 w-0.75 shrink-0 rounded-full bg-[color:var(--text-primary)] opacity-45"
                        aria-hidden
                      />
                      <span>Akış, gürültü değil düşünce sırasıdır.</span>
                    </li>
                    <li className="flex gap-2">
                      <span
                        className="mt-1.5 h-0.75 w-0.75 shrink-0 rounded-full bg-[color:var(--text-primary)] opacity-45"
                        aria-hidden
                      />
                      <span>Trabzon merkezli, ama dar değil.</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-1 pb-5 md:pt-1.5 md:pb-5">
                  <p className="sidebar-block-title">Etkileşim</p>
                  <ul className="sidebar-rail-copy m-0 list-none space-y-3.5 p-0 text-[color:var(--text-secondary)] md:space-y-4">
                    <li className="flex gap-2">
                      <span className="mt-0.5 shrink-0 text-[color:var(--text-muted)] opacity-65" aria-hidden>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </span>
                      <span>Yorumlar kısa ve saygılı tutulur.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-0.5 shrink-0 text-[color:var(--text-muted)] opacity-65" aria-hidden>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 6v6l4 2" />
                        </svg>
                      </span>
                      <span>Tarihli kayıtlar; metin önceliklidir.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-0.5 shrink-0 text-[color:var(--text-muted)] opacity-65" aria-hidden>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </span>
                      <span>Başlıktan içeriğe tek nefeste okuma.</span>
                    </li>
                  </ul>
                </div>

                <div className="category-rail-section pt-4 pb-0 md:pt-5 md:pb-0">
                  <p className="sidebar-block-title">Kategoriler</p>
                  <nav
                    className="category-rail-nav"
                    aria-label="Entry kategorileri"
                  >
                    {FEED_CATEGORY_OPTIONS.map((opt) => {
                      const isActive = feedCategoryFilter === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-category-filter={opt.id}
                          onClick={() => setFeedCategoryFilter(opt.id)}
                          aria-current={isActive ? "true" : undefined}
                          style={{ transition: "var(--transition)" }}
                          className={`category-rail-item group flex w-full cursor-pointer items-center gap-3 text-left ${
                            isActive ? "font-medium" : "font-normal"
                          }`}
                        >
                          <span className="category-rail-icon-wrap shrink-0" aria-hidden>
                            {categoryRailIcon(opt.id)}
                          </span>
                          <span className="category-rail-label min-w-0 flex-1">
                            <span className="category-rail-hash"># </span>
                            <span className="category-rail-name">{opt.label}</span>
                          </span>
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </div>
            </aside>
            </div>

            <section
              id="site-about"
              className="mt-1 border-t border-[color:var(--divide-hair)] bg-[var(--bg-primary)] px-4 py-9 md:mt-0 md:px-6 md:py-10 lg:px-3"
              aria-label="Özellikler"
            >
              <div className="mx-auto grid max-w-[80rem] grid-cols-1 items-start gap-8 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-9 md:grid-cols-3 md:gap-x-9 md:gap-y-10 lg:grid-cols-5 lg:gap-x-8 lg:gap-y-9">
                {[
                  {
                    t: "Yazabilirsin",
                    d: "Düşünceni metinle kur; tartışma sana ait bir çerçeveye oturur.",
                    icon: (
                      <>
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </>
                    ),
                  },
                  {
                    t: "Okuyabilirsin",
                    d: "Akış, gazete disiplininde; başlık ve özet birlikte nefes alır.",
                    icon: (
                      <>
                        <path d="M17 21v-8a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v8" />
                        <path d="M7 3h10a1 1 0 0 1 1 1v16" />
                      </>
                    ),
                  },
                  {
                    t: "Konuşabilirsin",
                    d: "Yorumlar kısa tutulur; cevaplar metnin altında kalır.",
                    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
                  },
                  {
                    t: "Hatırlanabilirsin",
                    d: "Kayıtlar ve başlıklar birlikte; şehrin hafızasına yazılır.",
                    icon: (
                      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                    ),
                  },
                  {
                    t: "Trabzon merkezli",
                    d: "Yerel kök, editoryal evrensel dil; sıcak ama ciddi yüzey.",
                    icon: (
                      <>
                        <path d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10z" />
                        <circle cx="12" cy="11" r="2.5" />
                      </>
                    ),
                  },
                ].map((item) => (
                  <div key={item.t} className="flex min-w-0 flex-col items-start gap-2.5">
                    <div className="text-[color:var(--text-muted)] opacity-[0.82]" aria-hidden>
                      <svg
                        width="19"
                        height="19"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      >
                        {item.icon}
                      </svg>
                    </div>
                    <p className="site-feature-title">{item.t}</p>
                    <p className="site-feature-desc">{item.d}</p>
                  </div>
                ))}
              </div>
            </section>

            <footer
              id="site-footer"
              className="site-footer mt-0 px-5 md:px-10"
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
