"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DAILY_COUNT,
  type DailySocialDraftsPayload,
  type SocialDraft,
  archiveReadyAndRegenerate,
  generateFreshDailyDrafts,
  isCompleteDailyPayload,
  loadDailyEntrySetFromStorage,
  loadDailySocialDraftsFromStorage,
  rebuildDraftsFromStoredEntrySet,
  saveDailyEntrySetToStorage,
  saveDailySocialDraftsToStorage,
  todayYmd,
} from "@/lib/daily-social-drafts";
import {
  addDistributionHistoryItem,
  loadDistributionHistory,
  saveDistributionHistory,
  type DistributionHistoryAction,
  type DistributionHistoryItem,
} from "@/lib/distribution-history";
import {
  type LarusEntry,
  fetchEntries,
  loadEntriesPoolFromStorage,
  mergeAndNormalizePool,
  saveEntriesPoolToStorage,
} from "@/lib/larus-entry-pool";
import {
  buildFacebookShareUrl,
  buildXIntentUrl,
  openShareWindow,
} from "@/lib/platform-share-links";

function statusLabel(s: SocialDraft["status"]): string {
  switch (s) {
    case "ready":
      return "Hazır";
    case "shared":
      return "Paylaşıldı";
    case "skipped":
      return "Vazgeçildi";
  }
}

function historyActionLabel(a: DistributionHistoryAction): string {
  switch (a) {
    case "shared":
      return "Paylaşıldı";
    case "skipped":
      return "Vazgeçildi";
    case "archived":
      return "Arşivlendi";
  }
}

function formatHistoryTime(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

function shortBody(text: string, max = 72): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default function XPanelPage() {
  const [pool, setPool] = useState<LarusEntry[]>([]);
  const [daily, setDaily] = useState<DailySocialDraftsPayload | null>(null);
  const [history, setHistory] = useState<DistributionHistoryItem[]>([]);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  useEffect(() => {
    const initial = loadEntriesPoolFromStorage() ?? [];
    setPool(initial);
    setHistory(loadDistributionHistory());
    let cancel = false;
    (async () => {
      try {
        const fresh = await fetchEntries();
        const merged = mergeAndNormalizePool(initial, fresh);
        saveEntriesPoolToStorage(merged);
        if (!cancel) setPool(merged);
      } catch (e) {
        console.warn("[xpanel] havuz güncellenemedi:", e);
        if (!cancel) setPool(initial);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    const today = todayYmd();
    const stored = loadDailySocialDraftsFromStorage();
    if (stored && stored.date === today && isCompleteDailyPayload(stored)) {
      setDaily(stored);
      const ids = stored.x.map((d) => d.entryId);
      const es = loadDailyEntrySetFromStorage();
      if (!es || es.date !== today || es.entryIds.join(",") !== ids.join(",")) {
        saveDailyEntrySetToStorage({ date: today, entryIds: ids });
      }
      return;
    }
    if (pool.length === 0) return;
    const h = loadDistributionHistory();
    const entrySet = loadDailyEntrySetFromStorage();
    if (
      entrySet &&
      entrySet.date === today &&
      entrySet.entryIds.length === DAILY_COUNT
    ) {
      const rebuilt = rebuildDraftsFromStoredEntrySet(pool, h, entrySet);
      if (rebuilt) {
        setDaily(rebuilt);
        return;
      }
    }
    const fresh = generateFreshDailyDrafts(pool, h, today);
    setDaily(fresh);
    saveDailySocialDraftsToStorage(fresh);
  }, [pool]);

  const persistDaily = useCallback((next: DailySocialDraftsPayload) => {
    setDaily(next);
    saveDailySocialDraftsToStorage(next);
    saveDailyEntrySetToStorage({
      date: next.date,
      entryIds: next.x.map((d) => d.entryId),
    });
  }, []);

  const showCopyToast = useCallback(() => {
    setCopyToast("Metin kopyalandı");
    window.setTimeout(() => setCopyToast(null), 2000);
  }, []);

  const copyText = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showCopyToast();
      } catch {
        showCopyToast();
      }
    },
    [showCopyToast],
  );

  const pushHistory = useCallback(
    (draft: SocialDraft, action: "shared" | "skipped") => {
      setHistory((prev) => {
        const nextHist = addDistributionHistoryItem(prev, {
          platform: draft.platform,
          entryId: draft.entryId,
          entryTitle: draft.entryTitle,
          text: draft.text,
          action,
          source: "draft",
        });
        saveDistributionHistory(nextHist);
        return nextHist;
      });
    },
    [],
  );

  const updateDraftStatus = useCallback(
    (draft: SocialDraft, status: SocialDraft["status"]) => {
      setDaily((prev) => {
        if (!prev) return prev;
        const mapOne = (d: SocialDraft) =>
          d.id === draft.id && d.platform === draft.platform ? { ...d, status } : d;
        const next = {
          ...prev,
          x: prev.x.map(mapOne),
          facebook: prev.facebook.map(mapOne),
        };
        saveDailySocialDraftsToStorage(next);
        saveDailyEntrySetToStorage({
          date: next.date,
          entryIds: next.x.map((d) => d.entryId),
        });
        return next;
      });
    },
    [],
  );

  const onShared = useCallback(
    (draft: SocialDraft) => {
      updateDraftStatus(draft, "shared");
      pushHistory(draft, "shared");
    },
    [pushHistory, updateDraftStatus],
  );

  const onSkipped = useCallback(
    (draft: SocialDraft) => {
      updateDraftStatus(draft, "skipped");
      pushHistory(draft, "skipped");
    },
    [pushHistory, updateDraftStatus],
  );

  const onRefreshDay = useCallback(() => {
    if (!daily || pool.length === 0) return;
    const h = loadDistributionHistory();
    const { payload, history: nextH } = archiveReadyAndRegenerate(
      daily,
      pool,
      h,
    );
    setHistory(nextH);
    persistDaily(payload);
  }, [daily, pool, persistDaily]);

  const sharedToday = useMemo(() => {
    if (!daily) return 0;
    let n = 0;
    for (let i = 0; i < DAILY_COUNT; i++) {
      const x = daily.x[i];
      const f = daily.facebook[i];
      if (!x || !f) continue;
      if (x.status === "shared" || f.status === "shared") n += 1;
    }
    return n;
  }, [daily]);

  const xDraftCount = useMemo(() => {
    if (daily) return daily.x.length;
    if (pool.length === 0) return 0;
    return "…";
  }, [daily, pool.length]);

  const fbDraftCount = useMemo(() => {
    if (daily) return daily.facebook.length;
    if (pool.length === 0) return 0;
    return "…";
  }, [daily, pool.length]);

  const historyPreview = useMemo(() => history.slice(0, 20), [history]);

  return (
    <div className="min-h-full bg-[#0a0a0c] text-zinc-100">
      {copyToast ? (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-zinc-600 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 shadow-xl"
          role="status"
        >
          {copyToast}
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-8">
        <header className="border-b border-zinc-700/80 pb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            61Larus Dağıtım Motoru
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
            61Larus entry’lerinden X ve Facebook için günlük trafik odaklı
            paylaşım taslakları üretir. Her gün aynı beş entry için platforma
            göre farklı metinler hazırlanır.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRefreshDay}
              disabled={!daily || pool.length === 0}
              className="rounded-lg border border-zinc-500 bg-zinc-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500"
            >
              Bugünün taslaklarını yenile
            </button>
            <span className="text-xs text-zinc-500">
              Hazır taslaklar arşivlenir; paylaşılanlar aynı kalır; yeni beşli
              set mümkünse farklı entry’lerden seçilir.
            </span>
          </div>
        </header>

        <section
          className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          aria-label="Günlük üretim özeti"
        >
          {[
            { label: "İçerik havuzu", value: pool.length },
            { label: "Bugünkü X taslakları", value: xDraftCount },
            {
              label: "Bugünkü Facebook taslakları",
              value: fbDraftCount,
            },
            { label: "Paylaşılan (bugün)", value: sharedToday },
            { label: "Geçmiş kaydı", value: history.length },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-zinc-700/90 bg-[#141416] px-4 py-3 shadow-sm"
            >
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {item.label}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-white">
                {item.value}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-12" aria-labelledby="x-drafts-heading">
          <h2
            id="x-drafts-heading"
            className="text-lg font-semibold text-white"
          >
            Günlük X paylaşımları
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {DAILY_COUNT} adet taslak — metin hazır; X’te aç ile düzenleyip
            yayınlayın.
          </p>
          <ul className="mt-6 space-y-4">
            {(daily?.x ?? []).map((draft) => (
              <li
                key={draft.id}
                className={`rounded-xl border bg-[#141416] p-4 shadow-sm ${
                  draft.status === "ready"
                    ? "border-zinc-600"
                    : "border-zinc-700"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      draft.status === "ready"
                        ? "bg-emerald-950/80 text-emerald-200 ring-1 ring-emerald-800/60"
                        : draft.status === "shared"
                          ? "bg-sky-950/80 text-sky-200 ring-1 ring-sky-800/50"
                          : "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-600"
                    }`}
                  >
                    {statusLabel(draft.status)}
                  </span>
                  <span className="truncate text-xs text-zinc-500">
                    {draft.entryTitle}
                  </span>
                </div>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-200">
                  {draft.text}
                </pre>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyText(draft.text)}
                    className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
                  >
                    Kopyala
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openShareWindow(buildXIntentUrl(draft.text))
                    }
                    className="rounded-lg border border-zinc-500 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                  >
                    X’te aç
                  </button>
                  <button
                    type="button"
                    onClick={() => onShared(draft)}
                    disabled={draft.status !== "ready"}
                    className="rounded-lg border border-emerald-600/70 bg-emerald-950/40 px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-900/50 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-transparent disabled:text-zinc-600"
                  >
                    Paylaşıldı
                  </button>
                  <button
                    type="button"
                    onClick={() => onSkipped(draft)}
                    disabled={draft.status !== "ready"}
                    className="rounded-lg border border-zinc-600 bg-zinc-800/50 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
                  >
                    Vazgeç
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="fb-drafts-heading">
          <h2
            id="fb-drafts-heading"
            className="text-lg font-semibold text-white"
          >
            Günlük Facebook paylaşımları
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {DAILY_COUNT} adet taslak — bağlantıyı paylaşırken metni kopyalayın.
          </p>
          <ul className="mt-6 space-y-4">
            {(daily?.facebook ?? []).map((draft) => (
              <li
                key={draft.id}
                className={`rounded-xl border bg-[#141416] p-4 shadow-sm ${
                  draft.status === "ready"
                    ? "border-zinc-600"
                    : "border-zinc-700"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      draft.status === "ready"
                        ? "bg-emerald-950/80 text-emerald-200 ring-1 ring-emerald-800/60"
                        : draft.status === "shared"
                          ? "bg-sky-950/80 text-sky-200 ring-1 ring-sky-800/50"
                          : "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-600"
                    }`}
                  >
                    {statusLabel(draft.status)}
                  </span>
                  <span className="truncate text-xs text-zinc-500">
                    {draft.entryTitle}
                  </span>
                </div>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-200">
                  {draft.text}
                </pre>
                <p className="mt-2 text-xs text-amber-200/90">
                  Facebook metnini kopyalayıp açılan paylaşım alanına yapıştır.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyText(draft.text)}
                    className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
                  >
                    Kopyala
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openShareWindow(buildFacebookShareUrl(draft.entryUrl))
                    }
                    className="rounded-lg border border-zinc-500 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                  >
                    Facebook’ta aç
                  </button>
                  <button
                    type="button"
                    onClick={() => onShared(draft)}
                    disabled={draft.status !== "ready"}
                    className="rounded-lg border border-emerald-600/70 bg-emerald-950/40 px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-900/50 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-transparent disabled:text-zinc-600"
                  >
                    Paylaşıldı
                  </button>
                  <button
                    type="button"
                    onClick={() => onSkipped(draft)}
                    disabled={draft.status !== "ready"}
                    className="rounded-lg border border-zinc-600 bg-zinc-800/50 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
                  >
                    Vazgeç
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14" aria-labelledby="history-heading">
          <h2 id="history-heading" className="text-lg font-semibold text-white">
            Paylaşım geçmişi
          </h2>
          <p className="mt-1 text-sm text-zinc-400">Son 20 kayıt</p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-700 bg-[#141416] shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-zinc-700 bg-[#1a1a1d] text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Tarih</th>
                  <th className="px-3 py-3 font-medium">Platform</th>
                  <th className="px-3 py-3 font-medium">Durum</th>
                  <th className="px-3 py-3 font-medium">Başlık</th>
                  <th className="px-3 py-3 font-medium">Kısa metin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {historyPreview.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-zinc-500"
                    >
                      Henüz kayıt yok.
                    </td>
                  </tr>
                ) : (
                  historyPreview.map((row) => (
                    <tr key={row.id} className="text-zinc-300">
                      <td className="whitespace-nowrap px-3 py-2.5 text-zinc-400">
                        {formatHistoryTime(row.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {row.platform === "x" ? "X" : "Facebook"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {historyActionLabel(row.action)}
                      </td>
                      <td className="max-w-[180px] px-3 py-2.5 text-zinc-400">
                        <span className="line-clamp-2">{row.entryTitle}</span>
                      </td>
                      <td className="max-w-[240px] px-3 py-2.5 text-zinc-500">
                        <span className="line-clamp-2">
                          {shortBody(row.text)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
