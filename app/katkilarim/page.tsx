import type { Metadata } from "next";
import Link from "next/link";
import { unstable_noStore } from "next/cache";
import {
  entryDetailHref,
  formatCommentDateTr,
  type EntryRowLite,
} from "@/lib/katkilarim-page";
import { SITE_BRAND } from "@/lib/entry-seo-metadata";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import {
  combinedFullNameFromParts,
  resolveVisibleName,
  type DisplayNameModePref,
} from "@/lib/visible-name";
import { KatkilarimChrome } from "./katkilarim-chrome";

type KatkilarimEntryRowLite = EntryRowLite & {
  category?: string | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Katkılarım | 61Sözlük",
  description: "Yorum yaptığın başlıklar burada birikir.",
  robots: { index: false, follow: true },
};

function KatkilarimFlowBackLink() {
  return (
    <p className="my-comments-flow-back-row katkilarim-back-row m-0">
      <Link
        href="/"
        prefetch
        scroll={false}
        className="my-comments-flow-back katkilarim-back"
      >
        ← Akışa dön
      </Link>
    </p>
  );
}

function KatkilarimHomeHero({
  isAuthenticated,
  heroUserLabel,
}: {
  isAuthenticated: boolean;
  heroUserLabel: string | null;
}) {
  const label =
    typeof heroUserLabel === "string" && heroUserLabel.trim().length > 0
      ? heroUserLabel.trim()
      : "\u2026";

  return (
    <header className="site-header site-header--home-faz83 site-header--trabzon-header home-header-banner relative z-20 shrink-0">
      <div className="home-hero-visual">
        <img
          src="/trabzon-gece-hafiza-banner.png"
          alt="Trabzon gece panoraması"
          className="home-hero-visual__image"
        />
        <div className="home-hero-visual__shade" aria-hidden="true" />
        <div
          className="absolute inset-0 z-[2] bg-black/50 md:bg-black/40 pointer-events-none rounded-[16px]"
          aria-hidden="true"
        />
        <div className="home-hero-content z-10 max-w-[420px] text-white">
          <h1 className="home-hero-title">
            <Link
              href="/"
              prefetch
              scroll={false}
              className="site-wordmark font-bold transition-opacity duration-200 hover:opacity-88"
              style={{ fontFeatureSettings: '"ss01" 1, "cv01" 1' }}
              aria-label="Ana sayfa — Akış"
            >
              {SITE_BRAND}
            </Link>
          </h1>
          <div className="home-hero-accent-line" aria-hidden="true" />
          <p className="home-hero-tagline">
            Trabzon&apos;un gündemi, <span>lafı ve hafızası</span>
          </p>
        </div>

        <div className="home-hero-user z-10">
          {!isAuthenticated ? (
            <Link href="/auth" prefetch className="!text-white">
              Giriş
            </Link>
          ) : (
            <>
              <Link
                href="/katkilarim"
                prefetch
                scroll={false}
                className="site-account-link shrink-0 !text-white"
              >
                Katkılarım
              </Link>
              <div className="relative z-30 min-w-0 shrink-0">
                <button
                  type="button"
                  className="account-menu-name-trigger max-w-full cursor-pointer border-0 bg-transparent p-0 !text-white"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                  aria-haspopup="menu"
                  aria-expanded={false}
                  aria-label="Hesap menüsü"
                >
                  <div
                    className="account-menu-trigger-inner flex min-h-9 w-full max-w-none items-center justify-center overflow-visible rounded-md px-0.5 py-0 md:min-h-8 md:justify-end"
                    style={{
                      transition: "var(--transition)",
                    }}
                  >
                    <span className="site-account-name account-menu-handle header-user mobileHeaderUserName block whitespace-nowrap text-right !text-white">
                      {label}
                    </span>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

async function katkilarimHeaderLabel(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  }
): Promise<string> {
  const meta = user.user_metadata;
  const fromFull =
    meta && typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  const fromName =
    meta && typeof meta.name === "string" ? meta.name.trim() : "";
  if (fromFull || fromName) return fromFull || fromName;

  const { data: row } = await supabase
    .from("users")
    .select("nickname, first_name, last_name, display_name_mode, email")
    .eq("id", user.id)
    .maybeSingle();

  if (row) {
    const dm = row.display_name_mode;
    const displayMode: DisplayNameModePref =
      dm === "nickname" || dm === "real_name" ? dm : null;
    const full = combinedFullNameFromParts(row.first_name, row.last_name);
    const emailFb =
      (typeof row.email === "string" && row.email.length > 0
        ? row.email
        : null) ??
      user.email ??
      null;
    const vis = resolveVisibleName({
      fullName: full,
      nickname: typeof row.nickname === "string" ? row.nickname : null,
      displayMode,
      emailFallback: emailFb,
    });
    if (vis !== "Kullanıcı") return vis;
  }
  return user.email?.split("@")[0]?.trim() || "kullanıcı";
}

export default async function KatkilarimPage() {
  unstable_noStore();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const headerLabel = user ? await katkilarimHeaderLabel(supabase, user) : "";

  if (!user) {
    return (
      <KatkilarimChrome
        isAuthenticated={false}
        headerDisplayName={null}
      >
        <div className="katkilarim-page-stack">
          <KatkilarimHomeHero isAuthenticated={false} heroUserLabel={null} />
          <div className="my-comments-page my-comments-page-inner">
            <div className="home-page-container katkilarim-wrapper mx-auto w-full py-8 md:py-10">
              <p className="my-comments-empty m-0 font-serif text-[1.05rem] leading-relaxed text-[color:var(--text-secondary)]">
                Katkılarını görmek için giriş yapmalısın.
              </p>
              <div className="mt-6">
                <KatkilarimFlowBackLink />
              </div>
            </div>
          </div>
        </div>
      </KatkilarimChrome>
    );
  }

  const { data: commentsRaw, error: commentsError } = await supabase
    .from("comments")
    .select("id, content, created_at, entry_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (commentsError) {
    return (
      <KatkilarimChrome
        isAuthenticated
        headerDisplayName={headerLabel}
      >
        <div className="katkilarim-page-stack">
          <KatkilarimHomeHero
            isAuthenticated
            heroUserLabel={headerLabel}
          />
          <div className="my-comments-page my-comments-page-inner">
            <div className="home-page-container katkilarim-wrapper mx-auto w-full py-8 md:py-10">
              <p className="my-comments-empty m-0 text-[color:var(--text-secondary)]">
                Katkılar yüklenirken bir sorun oluştu. Daha sonra tekrar dene.
              </p>
              <div className="mt-6">
                <KatkilarimFlowBackLink />
              </div>
            </div>
          </div>
        </div>
      </KatkilarimChrome>
    );
  }

  const comments = commentsRaw ?? [];
  const entryOrder: string[] = [];
  const seenEntry = new Set<string>();
  const countByEntry = new Map<string, number>();
  const lastCommentAtByEntry = new Map<string, string>();

  for (const c of comments) {
    const eid =
      typeof c.entry_id === "string" && c.entry_id.length > 0
        ? c.entry_id
        : null;
    if (!eid) continue;
    countByEntry.set(eid, (countByEntry.get(eid) ?? 0) + 1);
  }

  for (const c of comments) {
    const eid =
      typeof c.entry_id === "string" && c.entry_id.length > 0
        ? c.entry_id
        : null;
    if (!eid || seenEntry.has(eid)) continue;
    seenEntry.add(eid);
    entryOrder.push(eid);
    const ca = typeof c.created_at === "string" ? c.created_at : "";
    if (ca) lastCommentAtByEntry.set(eid, ca);
  }

  const entriesClient = createSupabaseServiceClient() ?? supabase;

  let suggestedQuery = entriesClient
    .from("entries")
    .select("id, title, slug, category")
    .not("slug", "is", null)
    .neq("slug", "")
    .order("created_at", { ascending: false });
  if (entryOrder.length > 0) {
    suggestedQuery = suggestedQuery.not(
      "id",
      "in",
      `(${entryOrder.join(",")})`,
    );
  }
  const { data: suggestedRaw, error: suggestedError } =
    await suggestedQuery.limit(3);

  if (suggestedError) {
    console.error(
      "[katkilarim] suggested entries",
      suggestedError.message,
    );
  }

  const suggestedRows = suggestedError
    ? []
    : (suggestedRaw ?? [])
        .filter(
          (r) =>
            typeof r.slug === "string" &&
            typeof r.id === "string" &&
            r.slug.trim().length > 0,
        )
        .map((r) => ({
          id: r.id,
          title: typeof r.title === "string" ? r.title : "",
          slug: r.slug.trim(),
          category:
            typeof r.category === "string" ? r.category : null,
        }))
        .slice(0, 3);

  if (entryOrder.length === 0) {
    return (
      <KatkilarimChrome
        isAuthenticated
        headerDisplayName={headerLabel}
      >
        <div className="katkilarim-page-stack">
          <KatkilarimHomeHero
            isAuthenticated
            heroUserLabel={headerLabel}
          />
          <div className="my-comments-page my-comments-page-inner">
            <div className="home-page-container katkilarim-wrapper mx-auto w-full py-8 md:py-10">
              <header className="katkilarim-header">
                <h1 className="my-comments-heading">Katkılarım</h1>
                <p className="my-comments-meta my-comments-page-intro">
                  Yorum yaptığın başlıklar burada birikir.
                </p>
              </header>
              <KatkilarimFlowBackLink />
              <p className="my-comments-empty my-comments-empty--below-back mt-8 m-0 font-serif text-[1.05rem] leading-relaxed text-[color:var(--text-secondary)]">
                Henüz katkın yok — akışa dön, bir başlık seç.
              </p>
            </div>
          </div>
        </div>
      </KatkilarimChrome>
    );
  }

  const { data: entryRows, error: entriesError } = await entriesClient
    .from("entries")
    .select("id, title, slug, created_at, category")
    .in("id", entryOrder);

  if (entriesError) {
    return (
      <KatkilarimChrome
        isAuthenticated
        headerDisplayName={headerLabel}
      >
        <div className="katkilarim-page-stack">
          <KatkilarimHomeHero
            isAuthenticated
            heroUserLabel={headerLabel}
          />
          <div className="my-comments-page my-comments-page-inner">
            <div className="home-page-container katkilarim-wrapper mx-auto w-full py-8 md:py-10">
              <p className="my-comments-empty m-0 text-[color:var(--text-secondary)]">
                Başlıklar yüklenirken bir sorun oluştu. Daha sonra tekrar dene.
              </p>
              <div className="mt-6">
                <KatkilarimFlowBackLink />
              </div>
            </div>
          </div>
        </div>
      </KatkilarimChrome>
    );
  }

  const byId = new Map<string, KatkilarimEntryRowLite>();
  for (const r of entryRows ?? []) {
    const row = r as KatkilarimEntryRowLite;
    if (row?.id) byId.set(row.id, row);
  }

  return (
    <KatkilarimChrome isAuthenticated headerDisplayName={headerLabel}>
      <div className="katkilarim-page-stack">
        <KatkilarimHomeHero isAuthenticated heroUserLabel={headerLabel} />
        <div className="my-comments-page my-comments-page-inner">
          <div className="home-page-container katkilarim-wrapper mx-auto w-full py-8 md:py-10">
            <header className="katkilarim-header">
              <h1 className="my-comments-heading">Katkılarım</h1>
              <p className="my-comments-meta my-comments-page-intro">
                Yorum yaptığın başlıklar burada birikir.
              </p>
            </header>
            <KatkilarimFlowBackLink />

            <ul className="my-comments-list flex list-none flex-col p-0 m-0">
            {entryOrder.filter((id) => byId.has(id)).map((entryId) => {
              const row = byId.get(entryId)!;
              const title =
                typeof row.title === "string" && row.title.trim().length > 0
                  ? row.title.trim()
                  : "Başlıksız";
              const lastAt = lastCommentAtByEntry.get(entryId) ?? "";
              const count = countByEntry.get(entryId) ?? 0;
              const dateLabel = formatCommentDateTr(lastAt);
              const countLabel =
                count === 1 ? "1 yorumun var" : `${count} yorumun var`;

              return (
                <li key={entryId} className="m-0 p-0">
                  <Link
                    href={entryDetailHref(row)}
                    prefetch
                    scroll={false}
                    className="my-comments-card katkilarim-card"
                  >
                    <div className="my-comments-card-row flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="my-comments-card-main min-w-0 flex-1">
                        <p className="my-comments-title katkilarim-card-title">
                          {title}
                        </p>
                        <p className="my-comments-meta my-comments-card-meta-row katkilarim-meta mt-2 m-0">
                          {dateLabel ? (
                            <>
                              <span className="my-comments-meta-quiet">
                                Son yorumun
                              </span>
                              {": "}
                              {dateLabel}
                              <span className="my-comments-meta-sep" aria-hidden>
                                {" "}
                                ·{" "}
                              </span>
                            </>
                          ) : null}
                          {countLabel}
                        </p>
                      </div>
                      <span className="my-comments-card-cta katkilarim-cta read-more-link shrink-0 sm:mt-0.5">
                        Devamını oku →
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          {suggestedRows.length > 0 && (
            <div className="katkilarim-related-block">
              <div className="katkilarim-related-kicker">
                BU BAŞLIKTA YORUMUNU BEKLİYOR
              </div>

              <ul className="katkilarim-related-list">
                {suggestedRows.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={
                        item.slug ? `/${item.slug}` : `/?entry=${item.id}`
                      }
                      className="katkilarim-related-link"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
    </KatkilarimChrome>
  );
}
