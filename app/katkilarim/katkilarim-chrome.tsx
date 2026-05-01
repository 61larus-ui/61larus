"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SearchEntryResult } from "@/app/api/search-entries/route";
import { anonymizeCurrentUserAccount } from "@/lib/anonymize-account";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { normalizeEntrySlug } from "@/lib/slug";
import { slugifyEntryTitle } from "@/lib/entry-slug";
import { SITE_BRAND } from "@/lib/entry-seo-metadata";

const HEADER_ATATURK_QUOTES = [
  "Ne mutlu Türküm diyene!",
  "Yurtta sulh, cihanda sulh.",
  "Hayatta en hakiki mürşit ilimdir.",
  "Ümitsiz durumlar yoktur.",
  "İstikbal göklerdedir.",
] as const;

function entryHrefPathFromSearch(row: SearchEntryResult): string {
  const fromDb = (row as { slug?: string | null }).slug?.trim();
  if (fromDb) return fromDb;
  const title = row.title ?? "";
  return (
    normalizeEntrySlug(title.trim()) || slugifyEntryTitle(title, row.id)
  );
}

function areaLabelFromCategory(category: string | null): string | null {
  if (!category) return null;
  const map: Record<string, string> = {
    pending: "Yazılmayı bekleyenler",
    trending: "Çok konuşulanlar",
    memory: "Hafızaya eklenenler",
    today: "Hafızaya eklenenler",
    understand_trabzon: "Trabzon'u anlamak için",
    waiting_to_read: "Okunmayı bekleyenler",
    question_of_day: "Günün soruları",
  };
  return map[category] ?? null;
}

export function KatkilarimChrome({
  isAuthenticated,
  headerDisplayName,
  children,
}: {
  isAuthenticated: boolean;
  headerDisplayName: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [headerEditorialIdx, setHeaderEditorialIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestOpen, setSearchSuggestOpen] = useState(false);
  const [homeSearchApiResults, setHomeSearchApiResults] = useState<
    SearchEntryResult[]
  >([]);
  const [homeSearchLoading, setHomeSearchLoading] = useState(false);
  const homeSearchListboxId = useId();
  const searchSuggestRootRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchReqSeqRef = useRef(0);

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [accountDeleteStep, setAccountDeleteStep] = useState<
    "idle" | "confirm"
  >("idle");
  const [accountDeleteLoading, setAccountDeleteLoading] = useState(false);
  const [accountDeleteError, setAccountDeleteError] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => {
      setHeaderEditorialIdx((i) => (i + 1) % HEADER_ATATURK_QUOTES.length);
    }, 14000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!searchSuggestOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const root = searchSuggestRootRef.current;
      if (root && !root.contains(e.target as Node)) {
        setSearchSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown, true);
    return () => document.removeEventListener("mousedown", onDocMouseDown, true);
  }, [searchSuggestOpen]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
      searchReqSeqRef.current += 1;
      queueMicrotask(() => {
        setHomeSearchLoading(false);
        setHomeSearchApiResults([]);
      });
      return;
    }
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null;
      const mySeq = (searchReqSeqRef.current += 1);
      setHomeSearchLoading(true);
      const url = `/api/search-entries?q=${encodeURIComponent(q)}`;
      void fetch(url)
        .then((r) => r.json() as Promise<{ results?: SearchEntryResult[] }>)
        .then((body) => {
          if (mySeq !== searchReqSeqRef.current) return;
          setHomeSearchApiResults(body.results ?? []);
          setHomeSearchLoading(false);
        })
        .catch(() => {
          if (mySeq !== searchReqSeqRef.current) return;
          setHomeSearchApiResults([]);
          setHomeSearchLoading(false);
        });
    }, 300);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const root = accountMenuRef.current;
      if (root && !root.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown, true);
    return () => document.removeEventListener("mousedown", onDocMouseDown, true);
  }, [isUserMenuOpen]);

  const onHomeSearchClear = useCallback(() => {
    setSearchQuery("");
    setSearchSuggestOpen(false);
  }, []);

  const onPickHomeSearchSuggestion = useCallback(
    (row: SearchEntryResult) => {
      setSearchQuery(row.title);
      setSearchSuggestOpen(false);
      const path = entryHrefPathFromSearch(row);
      const href = `/${encodeURI(path)}`;
      if (typeof router.prefetch === "function") {
        void router.prefetch(href);
      }
      void router.push(href);
    },
    [router]
  );

  const onHomeSearchInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      setSearchSuggestOpen(true);
    },
    []
  );

  const onHomeSearchInputFocus = useCallback(() => {
    setSearchSuggestOpen(true);
  }, []);

  const showTitleSearchPanel =
    searchSuggestOpen && searchQuery.trim().length >= 2;

  const onHomeSearchKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setSearchSuggestOpen(false);
      }
    },
    []
  );

  async function handleLogout() {
    setIsUserMenuOpen(false);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/";
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
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/";
      }
    } finally {
      setAccountDeleteLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen w-full max-w-full flex-col bg-transparent text-[color:var(--text-primary)] antialiased">
      <header className="site-header relative z-20 shrink-0">
        <div className="headerBlock home-page-container">
          <div className="headerBar min-w-0">
            <div className="header-text-group">
              <div className="flex min-w-0 flex-col gap-2 lg:max-w-[min(21rem,100%)]">
                <h1 className="m-0 p-0">
                  <Link
                    href="/"
                    prefetch
                    scroll={false}
                    className="site-wordmark max-w-full border-0 bg-transparent p-0 text-left transition-opacity duration-200 hover:opacity-88"
                    style={{ fontFeatureSettings: '"ss01" 1, "cv01" 1' }}
                    aria-label="Ana sayfa — Akış"
                  >
                    {SITE_BRAND}
                  </Link>
                </h1>
                <p className="site-header-tagline m-0 site-header-tagline--manifesto">
                  TRABZON&apos;UN GÜNDEMİ, LAFI VE HAFIZASI
                </p>
              </div>
              <div
                className="headerCenterText site-header-editorial header-quote ataturk-quote"
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
            </div>
            <div className="headerUserName site-header-aux min-w-0 justify-self-end gap-x-3 pl-1 sm:gap-x-4 lg:shrink-0 lg:gap-x-4 lg:pl-2 lg:pr-3">
              {!isAuthenticated ? (
                <Link
                  href="/auth"
                  prefetch
                  className="inline-flex shrink-0 items-center font-normal tracking-[0.04em] text-[color:var(--text-tertiary)] underline decoration-[color:var(--divide-muted)] decoration-1 underline-offset-[5px] transition-colors hover:text-[color:var(--text-secondary)]"
                >
                  Giriş
                </Link>
              ) : null}
              {isAuthenticated ? (
                <div className="site-account-nav min-w-0 shrink-0">
                  <span
                    className="site-account-name shrink-0"
                    aria-current="page"
                  >
                    Katkılarım
                  </span>
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
                        className="account-menu-trigger-inner flex min-h-9 min-w-0 max-w-full items-center justify-end rounded-md px-0.5 py-0.5"
                        style={{ transition: "var(--transition)" }}
                      >
                        <span className="site-account-name account-menu-handle header-user mobileHeaderUserName block min-w-0 max-w-full truncate text-right">
                          {headerDisplayName}
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
                              Bu işlem geri alınamaz. Profil bilgilerin kaldırılır;
                              eski içerikler anonim görünür.
                            </p>
                            <div className="account-menu-delete-actions">
                              <button
                                type="button"
                                disabled={accountDeleteLoading}
                                onClick={() => void handleConfirmAccountDeletion()}
                                className="account-menu-delete-confirm"
                              >
                                {accountDeleteLoading
                                  ? "İşleniyor…"
                                  : "Silmeyi onayla"}
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
                          <p className="account-menu-error m-0">
                            {accountDeleteError}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section className="relative z-0 flex w-full flex-col border-0 bg-[var(--bg-primary)]">
        <div className="home-page-editorial home-page-editorial--section-stack">
          <div
            ref={searchSuggestRootRef}
            className="home-manifesto home-manifesto--bridge home-search-bridge home-global-search home-manifesto-inner--bridge home-search-field relative z-50 min-w-0 w-full max-w-full"
          >
            <div className="home-manifesto-search home-global-search__column relative w-full min-w-0 max-w-full">
              <label htmlFor="katkilarim-search-input" className="sr-only">
                Arama
              </label>
              <div className="home-global-search__shell" role="search">
                <span className="home-global-search__icon" aria-hidden>
                  <svg
                    className="home-global-search__icon-svg"
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="10.5" cy="10.5" r="6.5" />
                    <path d="M15.2 15.2 20 20" />
                  </svg>
                </span>
                <input
                  id="katkilarim-search-input"
                  name="q"
                  type="text"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={showTitleSearchPanel}
                  aria-controls={
                    showTitleSearchPanel ? homeSearchListboxId : undefined
                  }
                  className="home-global-search__input search-input"
                  value={searchQuery}
                  onChange={onHomeSearchInputChange}
                  onFocus={onHomeSearchInputFocus}
                  onKeyDown={onHomeSearchKeyDown}
                  placeholder="Ne arıyorsun?"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="search"
                />
                {searchQuery.length > 0 ? (
                  <button
                    type="button"
                    className="home-global-search__clear"
                    onClick={onHomeSearchClear}
                    onMouseDown={(e) => e.preventDefault()}
                    aria-label="Aramayı temizle"
                  >
                    <span
                      className="home-global-search__clear-glyph"
                      aria-hidden
                    >
                      ×
                    </span>
                  </button>
                ) : null}
              </div>
              {showTitleSearchPanel ? (
                <ul
                  id={homeSearchListboxId}
                  role="listbox"
                  aria-label="Arama önerileri"
                  className="home-global-search__panel"
                >
                  {homeSearchLoading ? (
                    <li className="home-global-search__state">Aranıyor…</li>
                  ) : homeSearchApiResults.length === 0 ? (
                    <li className="home-global-search__state">
                      Sonuç bulunamadı.
                    </li>
                  ) : (
                    homeSearchApiResults.map((row) => {
                      const area = areaLabelFromCategory(row.category);
                      return (
                        <li
                          key={row.id}
                          role="option"
                          aria-selected={false}
                          className="home-global-search__option"
                        >
                          <button
                            type="button"
                            className="home-global-search__row"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => onPickHomeSearchSuggestion(row)}
                          >
                            <span className="home-global-search__title">
                              {row.title}
                            </span>
                            {area ? (
                              <span className="home-global-search__category">
                                {area}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              ) : null}
            </div>
          </div>
        </div>

        {children}
      </section>
    </main>
  );
}
