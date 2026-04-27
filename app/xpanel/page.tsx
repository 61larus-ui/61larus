"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type LarusEntry,
  contentPreview,
  fetchEntries,
  loadEntriesPoolFromStorage,
  mergeAndNormalizePool,
  saveEntriesPoolToStorage,
} from "@/lib/larus-entry-pool";
import {
  type TweetDraft,
  TWEET_MAX_LENGTH,
  generateTweetDraftsForEntry,
  loadTweetDraftsFromStorage,
  LARUS_TWEET_DRAFTS_KEY,
  saveTweetDraftsToStorage,
  variantLabel,
} from "@/lib/xpanel-tweet-drafts";

function variantBadgeClass(v: TweetDraft["variant"]): string {
  const base =
    "inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  switch (v) {
    case "hook":
      return `${base} bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/25`;
    case "info":
      return `${base} bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/25`;
    case "debate":
      return `${base} bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30`;
    default:
      return `${base} bg-zinc-800 text-zinc-400`;
  }
}

export default function XPanelPage() {
  const [icerikHavuzu, setIcerikHavuzu] = useState<LarusEntry[]>([]);
  const [icerikHavuzuYukleniyor, setIcerikHavuzuYukleniyor] = useState(true);
  const [icerikHavuzuHata, setIcerikHavuzuHata] = useState(false);

  const [taslaklar, setTaslaklar] = useState<TweetDraft[]>([]);
  const [taslakYuklendi, setTaslakYuklendi] = useState(false);

  const [kopyaTaslakId, setKopyaTaslakId] = useState<string | null>(null);
  const [kopyaSepetId, setKopyaSepetId] = useState<string | null>(null);
  const kopyaZamanRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let iptal = false;
    (async () => {
      const yerel = loadEntriesPoolFromStorage();
      if (yerel && yerel.length > 0) {
        if (!iptal) {
          setIcerikHavuzu(yerel);
          setIcerikHavuzuYukleniyor(false);
        }
        return;
      }
      setIcerikHavuzuHata(false);
      try {
        const taze = await fetchEntries();
        if (iptal) return;
        const birlesik = mergeAndNormalizePool([], taze);
        saveEntriesPoolToStorage(birlesik);
        setIcerikHavuzu(birlesik);
      } catch (e) {
        console.warn("[İçerik Havuzu] fetchEntries:", e);
        if (!iptal) setIcerikHavuzuHata(true);
      } finally {
        if (!iptal) setIcerikHavuzuYukleniyor(false);
      }
    })();
    return () => {
      iptal = true;
    };
  }, []);

  useEffect(() => {
    setTaslaklar(loadTweetDraftsFromStorage());
    setTaslakYuklendi(true);
  }, []);

  useEffect(() => {
    if (!taslakYuklendi) return;
    saveTweetDraftsToStorage(taslaklar);
  }, [taslaklar, taslakYuklendi]);

  const hizliOzet = useMemo(() => {
    const havuz = icerikHavuzu.length;
    const taslak = taslaklar.filter((t) => t.status === "draft").length;
    const sepet = taslaklar.filter((t) => t.status === "basket").length;
    const paylasilan = taslaklar.filter((t) => t.status === "shared").length;
    return { havuz, taslak, sepet, paylasilan };
  }, [icerikHavuzu.length, taslaklar]);

  const taslakListesi = useMemo(
    () =>
      taslaklar.filter((t) => t.status === "draft").sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [taslaklar],
  );

  const sepetListesi = useMemo(
    () =>
      taslaklar.filter((t) => t.status === "basket").sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [taslaklar],
  );

  const kopyalaMetin = useCallback((metin: string, id: string, sepet: boolean) => {
    void navigator.clipboard.writeText(metin);
    if (kopyaZamanRef.current) clearTimeout(kopyaZamanRef.current);
    if (sepet) {
      setKopyaSepetId(id);
      setKopyaTaslakId(null);
    } else {
      setKopyaTaslakId(id);
      setKopyaSepetId(null);
    }
    kopyaZamanRef.current = setTimeout(() => {
      setKopyaTaslakId(null);
      setKopyaSepetId(null);
      kopyaZamanRef.current = null;
    }, 2000);
  }, []);

  const tweetTaslagiUret = useCallback((entry: LarusEntry) => {
    setTaslaklar((prev) => {
      const yeni = generateTweetDraftsForEntry(entry, prev);
      if (yeni.length === 0) return prev;
      return [...yeni, ...prev];
    });
  }, []);

  const taslagSepete = useCallback((id: string) => {
    setTaslaklar((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "basket" as const } : t)),
    );
  }, []);

  const taslagAtla = useCallback((id: string) => {
    setTaslaklar((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "skipped" as const } : t)),
    );
  }, []);

  const sepetPaylasildi = useCallback((id: string) => {
    setTaslaklar((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "shared" as const } : t)),
    );
  }, []);

  const sepetVazgec = useCallback((id: string) => {
    setTaslaklar((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "skipped" as const } : t)),
    );
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <p className="shrink-0 border-b border-zinc-800/60 bg-zinc-950/98 px-4 py-1.5 text-center text-[10px] text-zinc-500 sm:px-6">
        Veriler bu cihazda kaydedilir · <span className="font-mono">{LARUS_TWEET_DRAFTS_KEY}</span>
      </p>
      <header className="shrink-0 border-b border-zinc-800/80 bg-zinc-950/95 px-4 py-2.5 backdrop-blur sm:px-6 sm:py-3">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              61Larus X Dağıtım Motoru
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
              61Larus içeriklerinden X için trafik odaklı paylaşım taslakları üretir.
            </p>
          </div>

          <section
            className="rounded-lg border border-zinc-800/80 bg-zinc-900/55 p-2.5 ring-1 ring-zinc-800/40 sm:p-3"
            aria-label="Hızlı özet"
          >
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Hızlı özet
            </h3>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-4">
              <div className="rounded-md bg-zinc-950/40 px-2 py-1.5">
                <dt className="text-[10px] font-medium text-zinc-500">
                  İçerik havuzu
                </dt>
                <dd className="text-base font-bold tabular-nums text-zinc-100 sm:text-lg">
                  {hizliOzet.havuz}
                </dd>
              </div>
              <div className="rounded-md bg-zinc-950/40 px-2 py-1.5">
                <dt className="text-[10px] font-medium text-zinc-500">
                  Taslak
                </dt>
                <dd className="tabular-nums font-semibold text-sky-300">
                  {hizliOzet.taslak}
                </dd>
              </div>
              <div className="rounded-md bg-zinc-950/40 px-2 py-1.5">
                <dt className="text-[10px] font-medium text-zinc-500">
                  Sepette bekleyen
                </dt>
                <dd className="tabular-nums font-semibold text-amber-200">
                  {hizliOzet.sepet}
                </dd>
              </div>
              <div className="rounded-md bg-zinc-950/40 px-2 py-1.5">
                <dt className="text-[10px] font-medium text-zinc-500">
                  Paylaşılan
                </dt>
                <dd className="tabular-nums font-semibold text-emerald-300">
                  {hizliOzet.paylasilan}
                </dd>
              </div>
            </dl>
          </section>

          <section
            className="rounded-lg border border-zinc-800/80 bg-zinc-900/55 p-2.5 ring-1 ring-zinc-800/40 sm:p-3"
            aria-label="İçerik havuzu"
          >
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              İçerik Havuzu
            </h3>
            <p className="mt-1 text-[11px] text-zinc-500">
              61larus.com özetleri — bu cihazda{" "}
              <span className="font-mono text-zinc-400">larus_entries_pool</span>
            </p>
            {icerikHavuzuYukleniyor ? (
              <p className="mt-2 text-sm text-zinc-400">İçerik taranıyor…</p>
            ) : icerikHavuzuHata ? (
              <p className="mt-2 text-sm text-amber-300/90">
                İçerik çekilemedi. Ağ veya proxy (next rewrites) için konsolu
                kontrol edin.
              </p>
            ) : icerikHavuzu.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">
                Havuz boş — uygun özet bulunamadı.
              </p>
            ) : (
              <ul className="mt-2 max-h-[min(28rem,50vh)] space-y-2 overflow-y-auto pr-1">
                {icerikHavuzu.slice(0, 20).map((madde) => (
                  <li
                    key={madde.id}
                    className="rounded-md border border-zinc-800/70 bg-zinc-950/45 px-2.5 py-2"
                  >
                    <p className="text-sm font-medium leading-snug text-zinc-100">
                      {madde.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                      {contentPreview(madde.content, 160)}
                    </p>
                    <button
                      type="button"
                      onClick={() => tweetTaslagiUret(madde)}
                      className="mt-2 rounded-md border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20"
                    >
                      Tweet taslağı üret
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="rounded-lg border border-zinc-800/80 bg-zinc-900/55 p-2.5 ring-1 ring-zinc-800/40 sm:p-3"
            aria-label="Tweet taslakları"
          >
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Tweet Taslakları
            </h3>
            {taslakListesi.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">
                Henüz taslak yok. Havuzdan &quot;Tweet taslağı üret&quot; ile ekleyin.
              </p>
            ) : (
              <ul className="mt-2 max-h-[min(32rem,55vh)] space-y-2 overflow-y-auto pr-1">
                {taslakListesi.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-md border border-zinc-800/70 bg-zinc-950/45 p-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={variantBadgeClass(t.variant)}>
                        {variantLabel(t.variant)}
                      </span>
                      <span className="text-[10px] tabular-nums text-zinc-500">
                        {t.text.length} / {TWEET_MAX_LENGTH}
                      </span>
                      {t.hasLink ? (
                        <span className="text-[10px] text-zinc-600">linkli</span>
                      ) : null}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
                      {t.text}
                    </p>
                    <p className="mt-1.5 text-[11px] text-zinc-500">
                      Kaynak:{" "}
                      <span className="text-zinc-400">{t.entryTitle}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => taslagSepete(t.id)}
                        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                      >
                        Sepete ekle
                      </button>
                      <button
                        type="button"
                        onClick={() => taslagAtla(t.id)}
                        className="rounded-md border border-zinc-600/80 bg-zinc-800/50 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                      >
                        Atla
                      </button>
                      <button
                        type="button"
                        onClick={() => kopyalaMetin(t.text, t.id, false)}
                        className="rounded-md border border-zinc-600/80 bg-zinc-800/50 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
                      >
                        {kopyaTaslakId === t.id ? "Kopyalandı" : "Kopyala"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 ring-1 ring-zinc-800/50"
            aria-label="Günlük paylaşım sepeti"
          >
            <h3 className="text-sm font-semibold text-zinc-100">
              Günlük Paylaşım Sepeti
            </h3>
            {sepetListesi.length === 0 ? (
              <p className="mt-1.5 text-sm text-zinc-500">
                Sepette bekleyen taslak yok.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {sepetListesi.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={variantBadgeClass(t.variant)}>
                        {variantLabel(t.variant)}
                      </span>
                      <span className="text-[10px] tabular-nums text-zinc-500">
                        {t.text.length} karakter
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
                      {t.text}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {t.entryTitle}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => sepetPaylasildi(t.id)}
                        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                      >
                        Paylaşıldı
                      </button>
                      <button
                        type="button"
                        onClick={() => sepetVazgec(t.id)}
                        className="rounded-md border border-zinc-600 bg-zinc-800/60 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                      >
                        Vazgeç
                      </button>
                      <button
                        type="button"
                        onClick={() => kopyalaMetin(t.text, t.id, true)}
                        className="rounded-md border border-zinc-600/80 bg-zinc-800/50 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
                      >
                        {kopyaSepetId === t.id ? "Kopyalandı" : "Kopyala"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </header>
    </div>
  );
}
