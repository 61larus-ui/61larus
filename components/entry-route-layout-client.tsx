"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  combinedFullNameFromParts,
  resolveVisibleName,
  type DisplayNameModePref,
} from "@/lib/visible-name";

const HEADER_ATATURK_QUOTES = [
  "Ne mutlu Türküm diyene!",
  "Yurtta sulh, cihanda sulh.",
  "Hayatta en hakiki mürşit ilimdir.",
  "Ümitsiz durumlar yoktur.",
  "İstikbal göklerdedir.",
] as const;

type FooterInfoId = "about" | "rules" | "privacy" | "contact";

function displayNameFromUserMetadata(
  meta: Record<string, unknown> | null | undefined
): string {
  if (!meta) return "";
  const full = meta["full_name"];
  const name = meta["name"];
  return (
    (typeof full === "string" ? full.trim() : "") ||
    (typeof name === "string" ? name.trim() : "") ||
    ""
  );
}

export function EntryRouteLayoutClient({
  children,
  isAuthenticated,
  userEmail,
  userMetadata: userMetadataFromServer,
  initialPlatformAccessSuspended,
}: {
  children: ReactNode;
  isAuthenticated: boolean;
  userEmail: string | null;
  /** RSC sırasında `getUser().user_metadata`; istemci efektinde öncelikli ad kaynağı. */
  userMetadata?: Record<string, unknown> | null;
  initialPlatformAccessSuspended: boolean;
}) {
  const [headerEditorialIdx, setHeaderEditorialIdx] = useState(0);
  const [footerInfoOpen, setFooterInfoOpen] = useState<FooterInfoId | null>(
    null
  );
  /** Sunucudan gelen e-posta + istemci profil çözümlemesi; resolved null iken e-posta öneği hemen gösterilir. */
  const [resolvedAccountLabel, setResolvedAccountLabel] = useState<
    string | null
  >(null);

  const closeFooterInfo = useCallback(() => {
    setFooterInfoOpen(null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => {
      setHeaderEditorialIdx((i) => (i + 1) % HEADER_ATATURK_QUOTES.length);
    }, 14000);
    return () => window.clearInterval(id);
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
    if (!isAuthenticated) {
      setResolvedAccountLabel(null);
      return;
    }
    setResolvedAccountLabel(null);
    let cancelled = false;
    void (async () => {
      const fromPropMeta = displayNameFromUserMetadata(userMetadataFromServer);
      if (fromPropMeta) {
        setResolvedAccountLabel(fromPropMeta);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setResolvedAccountLabel("kullanıcı");
        return;
      }

      const fromSessionMeta = displayNameFromUserMetadata(
        user.user_metadata as Record<string, unknown> | undefined
      );
      if (fromSessionMeta) {
        setResolvedAccountLabel(fromSessionMeta);
        return;
      }

      const { data: row, error } = await supabase
        .from("users")
        .select("nickname, first_name, last_name, display_name_mode, email")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const profile = !error && row ? row : null;
      const dmRaw =
        profile &&
        typeof profile.display_name_mode === "string" &&
        (profile.display_name_mode === "nickname" ||
          profile.display_name_mode === "real_name")
          ? profile.display_name_mode
          : null;
      const displayMode: DisplayNameModePref = dmRaw;
      const nick =
        profile && typeof profile.nickname === "string"
          ? profile.nickname
          : null;

      const full = combinedFullNameFromParts(
        profile?.first_name ?? null,
        profile?.last_name ?? null
      );
      const emailFallback =
        (profile &&
        typeof profile.email === "string" &&
        profile.email.length > 0
          ? profile.email
          : null) ?? user.email;

      const fromProfile = resolveVisibleName({
        fullName: full,
        nickname: nick,
        displayMode,
        emailFallback,
      });
      if (fromProfile !== "Kullanıcı") {
        setResolvedAccountLabel(fromProfile);
        return;
      }

      const local =
        userEmail?.split("@")[0]?.trim() ||
        user.email?.split("@")[0]?.trim() ||
        "";
      setResolvedAccountLabel(local || "kullanıcı");
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userEmail, userMetadataFromServer]);

  const headerDisplayName =
    !isAuthenticated
      ? ""
      : resolvedAccountLabel !== null
        ? resolvedAccountLabel
        : userEmail
          ? userEmail.split("@")[0]?.trim() || "kullanıcı"
          : "\u2026";

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

              <span style={{ fontWeight: 500 }}>WhatsApp danışma hattı</span>
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
            <div className="header-text-group">
              <div className="flex min-w-0 flex-col gap-2 lg:max-w-[min(21rem,100%)]">
                <h1 className="m-0 p-0">
                  <Link
                    href="/"
                    scroll={false}
                    className="site-wordmark max-w-full border-0 bg-transparent p-0 text-left transition-opacity duration-200 hover:opacity-88"
                    style={{ fontFeatureSettings: '"ss01" 1, "cv01" 1' }}
                    aria-label="Ana sayfa — Akış"
                  >
                    61Larus
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
                  className="inline-flex shrink-0 items-center font-normal tracking-[0.04em] text-[color:var(--text-tertiary)] underline decoration-[color:var(--divide-muted)] decoration-1 underline-offset-[5px] transition-colors hover:text-[color:var(--text-secondary)]"
                >
                  Giriş
                </Link>
              ) : (
                <div className="site-account-nav max-w-full min-w-0 justify-end">
                  <Link
                    href="/katkilarim"
                    scroll={false}
                    className="site-account-link shrink-0"
                  >
                    Katkılarım
                  </Link>
                  <span className="site-account-name account-menu-handle header-user mobileHeaderUserName block min-w-0 max-w-full truncate text-right">
                    {headerDisplayName}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="relative z-0 flex w-full flex-col border-0 bg-[var(--bg-primary)]">
        {isAuthenticated && initialPlatformAccessSuspended ? (
          <div className="platform-access-suspended-notice" role="status">
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
        {children}
        <footer
          id="site-footer"
          className="site-footer home-page-footer home-page-footer--after-explore"
        >
          <div className="home-page-container flex flex-col gap-7 md:flex-row md:items-baseline md:justify-between md:gap-8">
            <Link
              href="/"
              scroll={false}
              className="site-wordmark border-0 bg-transparent p-0 text-left transition-opacity duration-200 hover:opacity-90"
            >
              61Larus
            </Link>
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
              <span
                className="text-[color:rgba(240,241,244,0.25)]"
                aria-hidden
              >
                ·
              </span>
              <button
                type="button"
                className="footer-link-btn"
                onClick={() => setFooterInfoOpen("rules")}
              >
                Kurallar
              </button>
              <span
                className="text-[color:rgba(240,241,244,0.25)]"
                aria-hidden
              >
                ·
              </span>
              <button
                type="button"
                className="footer-link-btn"
                onClick={() => setFooterInfoOpen("privacy")}
              >
                Gizlilik
              </button>
              <span
                className="text-[color:rgba(240,241,244,0.25)]"
                aria-hidden
              >
                ·
              </span>
              <button
                type="button"
                className="footer-link-btn"
                onClick={() => setFooterInfoOpen("contact")}
              >
                İletişim
              </button>
              <span
                className="text-[color:rgba(240,241,244,0.25)]"
                aria-hidden
              >
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
              <span
                className="text-[color:rgba(240,241,244,0.25)]"
                aria-hidden
              >
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
              <span
                className="text-[color:rgba(240,241,244,0.25)]"
                aria-hidden
              >
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
              <Link
                href="/"
                scroll={false}
                className="inline cursor-pointer border-0 bg-transparent p-0 font-inherit text-inherit align-baseline transition-opacity duration-200 hover:opacity-100"
                aria-label="Ana sayfa — Akış"
              >
                61Larus
              </Link>
            </p>
          </div>
        </footer>
      </section>

      {renderFooterInfoPanel()}
    </main>
  );
}
