import type { Metadata } from "next";
import Link from "next/link";
import { unstable_noStore } from "next/cache";
import {
  entryDetailHref,
  formatCommentDateTr,
  type EntryRowLite,
} from "@/lib/katkilarim-page";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import {
  combinedFullNameFromParts,
  resolveVisibleName,
  type DisplayNameModePref,
} from "@/lib/visible-name";
import { KatkilarimChrome } from "./katkilarim-chrome";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Katkılarım | 61Larus",
  description: "Yorum yaptığın başlıklar",
  robots: { index: false, follow: true },
};

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
        <div className="my-comments-page my-comments-page-inner">
          <div className="home-page-container mx-auto w-full py-8 md:py-10">
            <p className="my-comments-empty m-0 font-serif text-[1.05rem] leading-relaxed text-[color:var(--text-secondary)]">
              Katkılarını görmek için giriş yapmalısın.
            </p>
            <p className="mt-5 m-0">
              <Link
                href="/"
                scroll={false}
                className="text-sm font-normal tracking-wide text-[color:var(--text-tertiary)] underline decoration-[color:var(--divide-muted)] decoration-1 underline-offset-[5px] transition-colors hover:text-[color:var(--text-secondary)]"
              >
                Akışa dön
              </Link>
            </p>
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
        <div className="my-comments-page my-comments-page-inner">
          <div className="home-page-container mx-auto w-full py-8 md:py-10">
            <p className="my-comments-empty m-0 text-[color:var(--text-secondary)]">
              Katkılar yüklenirken bir sorun oluştu. Daha sonra tekrar dene.
            </p>
            <p className="mt-5 m-0">
              <Link
                href="/"
                scroll={false}
                className="text-sm font-normal tracking-wide text-[color:var(--text-tertiary)] underline decoration-[color:var(--divide-muted)] decoration-1 underline-offset-[5px] transition-colors hover:text-[color:var(--text-secondary)]"
              >
                Akışa dön
              </Link>
            </p>
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

  if (entryOrder.length === 0) {
    return (
      <KatkilarimChrome
        isAuthenticated
        headerDisplayName={headerLabel}
      >
        <div className="my-comments-page my-comments-page-inner">
          <div className="home-page-container mx-auto w-full py-8 md:py-10">
            <h1 className="my-comments-page-heading">Katkılarım</h1>
            <p className="my-comments-meta my-comments-page-intro">
              Yorum yaptığın başlıklar; her biri bir kez listelenir.
            </p>
            <p className="my-comments-empty mt-8 m-0 font-serif text-[1.05rem] leading-relaxed text-[color:var(--text-secondary)]">
              Henüz yorum yaptığın bir başlık yok.
            </p>
            <p className="mt-5 m-0">
              <Link
                href="/"
                scroll={false}
                className="text-sm font-normal tracking-wide text-[color:var(--text-tertiary)] underline decoration-[color:var(--divide-muted)] decoration-1 underline-offset-[5px] transition-colors hover:text-[color:var(--text-secondary)]"
              >
                Akışa dön
              </Link>
            </p>
          </div>
        </div>
      </KatkilarimChrome>
    );
  }

  const entriesClient = createSupabaseServiceClient() ?? supabase;
  const { data: entryRows, error: entriesError } = await entriesClient
    .from("entries")
    .select("id, title, slug, created_at")
    .in("id", entryOrder);

  if (entriesError) {
    return (
      <KatkilarimChrome
        isAuthenticated
        headerDisplayName={headerLabel}
      >
        <div className="my-comments-page my-comments-page-inner">
          <div className="home-page-container mx-auto w-full py-8 md:py-10">
            <p className="my-comments-empty m-0 text-[color:var(--text-secondary)]">
              Başlıklar yüklenirken bir sorun oluştu. Daha sonra tekrar dene.
            </p>
            <p className="mt-5 m-0">
              <Link
                href="/"
                scroll={false}
                className="text-sm font-normal tracking-wide text-[color:var(--text-tertiary)] underline decoration-[color:var(--divide-muted)] decoration-1 underline-offset-[5px] transition-colors hover:text-[color:var(--text-secondary)]"
              >
                Akışa dön
              </Link>
            </p>
          </div>
        </div>
      </KatkilarimChrome>
    );
  }

  const byId = new Map<string, EntryRowLite>();
  for (const r of entryRows ?? []) {
    const row = r as EntryRowLite;
    if (row?.id) byId.set(row.id, row);
  }

  return (
    <KatkilarimChrome isAuthenticated headerDisplayName={headerLabel}>
      <div className="my-comments-page my-comments-page-inner">
        <div className="home-page-container mx-auto w-full py-8 md:py-10">
          <h1 className="my-comments-page-heading">Katkılarım</h1>
          <p className="my-comments-meta my-comments-page-intro">
            Yorum yaptığın başlıklar; her biri bir kez listelenir.
          </p>

          <ul className="my-comments-list mt-8 flex list-none flex-col gap-4 p-0 m-0 md:mt-10">
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
                    scroll={false}
                    className="my-comments-card"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="my-comments-title">{title}</p>
                        <p className="my-comments-meta mt-2 m-0 text-[13px] leading-relaxed text-[color:var(--text-tertiary)]">
                          {dateLabel ? (
                            <>
                              Son yorumun: {dateLabel}
                              <span aria-hidden> · </span>
                            </>
                          ) : null}
                          {countLabel}
                        </p>
                      </div>
                      <span className="my-comments-meta shrink-0 text-[13px] text-[color:var(--text-tertiary)] sm:pt-0.5">
                        Yazıyı aç →
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="mt-10 m-0">
            <Link
              href="/"
              scroll={false}
              className="text-sm font-normal tracking-wide text-[color:var(--text-tertiary)] underline decoration-[color:var(--divide-muted)] decoration-1 underline-offset-[5px] transition-colors hover:text-[color:var(--text-secondary)]"
            >
              Akışa dön
            </Link>
          </p>
        </div>
      </div>
    </KatkilarimChrome>
  );
}
