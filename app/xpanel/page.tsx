"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
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

function DraftBody({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="xpanel-draft-body whitespace-pre-wrap font-sans text-[15px] leading-relaxed">
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 ? "\n" : null}
          {/^https?:\/\//i.test(line.trim()) ? (
            <span className="xpanel-draft-link break-all">{line}</span>
          ) : (
            line
          )}
        </Fragment>
      ))}
    </div>
  );
}

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

export default function XPanelPage() {
  const [pool, setPool] = useState<LarusEntry[]>([]);
  const [daily, setDaily] = useState<DailySocialDraftsPayload | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  useEffect(() => {
    const initial = loadEntriesPoolFromStorage() ?? [];
    setPool(initial);
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

  const pushHistory = useCallback((draft: SocialDraft, action: "shared" | "skipped") => {
    const prev = loadDistributionHistory();
    const nextHist = addDistributionHistoryItem(prev, {
      platform: draft.platform,
      entryId: draft.entryId,
      entryTitle: draft.entryTitle,
      text: draft.text,
      action,
      source: "draft",
    });
    saveDistributionHistory(nextHist);
  }, []);

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

  const onRefreshDay = useCallback(() => {
    if (!daily || pool.length === 0) return;
    const h = loadDistributionHistory();
    const { payload } = archiveReadyAndRegenerate(daily, pool, h);
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

  return (
    <div className="xpanel-root">
      {copyToast ? (
        <div className="xpanel-toast" role="status">
          {copyToast}
        </div>
      ) : null}

      <div className="xpanel-inner">
        <header className="xpanel-header">
          <h1 className="xpanel-title">61Larus Dağıtım Motoru</h1>
          <button
            type="button"
            onClick={onRefreshDay}
            disabled={!daily || pool.length === 0}
            className="xpanel-btn-secondary"
          >
            Bugünün taslaklarını yenile
          </button>
        </header>

        <section
          className="xpanel-stats"
          aria-label="Özet"
        >
          {[
            { label: "Havuz", value: pool.length },
            { label: "X taslak", value: xDraftCount },
            { label: "Facebook taslak", value: fbDraftCount },
            { label: "Paylaşılan", value: sharedToday },
          ].map((item) => (
            <div key={item.label} className="xpanel-stat card">
              <div className="xpanel-stat-label">{item.label}</div>
              <div className="xpanel-stat-value">{item.value}</div>
            </div>
          ))}
        </section>

        <section className="xpanel-section" aria-labelledby="x-drafts-heading">
          <h2 id="x-drafts-heading" className="xpanel-section-title">
            X
          </h2>
          <ul className="xpanel-card-list">
            {(daily?.x ?? []).map((draft) => (
              <li
                key={draft.id}
                className="xpanel-card card"
                data-status={draft.status}
              >
                <div className="xpanel-card-top">
                  <span className="xpanel-badge">{statusLabel(draft.status)}</span>
                </div>
                <DraftBody text={draft.text} />
                <div className="xpanel-card-actions">
                  <button
                    type="button"
                    onClick={() => copyText(draft.text)}
                    className="xpanel-btn-primary"
                  >
                    Kopyala
                  </button>
                  <button
                    type="button"
                    onClick={() => openShareWindow(buildXIntentUrl(draft.text))}
                    className="xpanel-btn-secondary"
                  >
                    X’te aç
                  </button>
                  <button
                    type="button"
                    onClick={() => onShared(draft)}
                    disabled={draft.status !== "ready"}
                    className="xpanel-btn-ghost"
                  >
                    Paylaşıldı
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="xpanel-section" aria-labelledby="fb-drafts-heading">
          <h2 id="fb-drafts-heading" className="xpanel-section-title">
            Facebook
          </h2>
          <ul className="xpanel-card-list">
            {(daily?.facebook ?? []).map((draft) => (
              <li
                key={draft.id}
                className="xpanel-card card"
                data-status={draft.status}
              >
                <div className="xpanel-card-top">
                  <span className="xpanel-badge">{statusLabel(draft.status)}</span>
                </div>
                <DraftBody text={draft.text} />
                <div className="xpanel-card-actions">
                  <button
                    type="button"
                    onClick={() => copyText(draft.text)}
                    className="xpanel-btn-primary"
                  >
                    Kopyala
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openShareWindow(buildFacebookShareUrl(draft.entryUrl))
                    }
                    className="xpanel-btn-secondary"
                  >
                    Facebook’ta aç
                  </button>
                  <button
                    type="button"
                    onClick={() => onShared(draft)}
                    disabled={draft.status !== "ready"}
                    className="xpanel-btn-ghost"
                  >
                    Paylaşıldı
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
