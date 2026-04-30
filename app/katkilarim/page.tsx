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

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Katkılarım | 61Larus",
  description: "Yorum yaptığın başlıklar",
  robots: { index: false, follow: true },
};

export default async function KatkilarimPage() {
  unstable_noStore();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="my-comments-page">
        <div className="home-page-container mx-auto w-full max-w-2xl py-10 md:py-14">
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
      </main>
    );
  }

  const { data: commentsRaw, error: commentsError } = await supabase
    .from("comments")
    .select("id, content, created_at, entry_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (commentsError) {
    return (
      <main className="my-comments-page">
        <div className="home-page-container mx-auto w-full max-w-2xl py-10 md:py-14">
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
      </main>
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
    const ca =
      typeof c.created_at === "string" ? c.created_at : "";
    if (ca) lastCommentAtByEntry.set(eid, ca);
  }

  if (entryOrder.length === 0) {
    return (
      <main className="my-comments-page">
        <div className="home-page-container mx-auto w-full max-w-2xl py-10 md:py-14">
          <h1 className="m-0 font-serif text-[1.65rem] font-normal tracking-tight text-[color:var(--text-primary)] md:text-[1.85rem]">
            Katkılarım
          </h1>
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
      </main>
    );
  }

  const entriesClient = createSupabaseServiceClient() ?? supabase;
  const { data: entryRows, error: entriesError } = await entriesClient
    .from("entries")
    .select("id, title, slug, created_at")
    .in("id", entryOrder);

  if (entriesError) {
    return (
      <main className="my-comments-page">
        <div className="home-page-container mx-auto w-full max-w-2xl py-10 md:py-14">
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
      </main>
    );
  }

  const byId = new Map<string, EntryRowLite>();
  for (const r of entryRows ?? []) {
    const row = r as EntryRowLite;
    if (row?.id) byId.set(row.id, row);
  }

  return (
    <main className="my-comments-page">
      <div className="home-page-container mx-auto w-full max-w-2xl py-10 md:py-14">
        <h1 className="m-0 font-serif text-[1.65rem] font-normal tracking-tight text-[color:var(--text-primary)] md:text-[1.85rem]">
          Katkılarım
        </h1>
        <p className="my-comments-meta mt-2 m-0 text-sm text-[color:var(--text-tertiary)]">
          Yorum yaptığın başlıklar; her biri bir kez listelenir.
        </p>

        <ul className="mt-10 flex list-none flex-col gap-4 p-0 m-0">
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
    </main>
  );
}
