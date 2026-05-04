"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AdminRole } from "@/lib/admin-role";

type SeoModuleCard = {
  title: string;
  description: string;
  status: string;
};

const SEO_MODULES: SeoModuleCard[] = [
  {
    title: "Teknik SEO",
    description:
      "Sitemap, robots, canonical, 404 ve meta kontrolleri burada izlenecek.",
    status: "Tarama aktif",
  },
  {
    title: "Google Search Console",
    description:
      "Gösterim, tıklama, sıralama ve index durumu burada analiz edilecek.",
    status: "Bağlantı bekliyor",
  },
  {
    title: "Gündem Motoru",
    description:
      "Google trendleri ve X gündemi 61Sözlük’e uygun başlık fırsatları için taranacak.",
    status: "Planlandı",
  },
  {
    title: "Gemini Analiz",
    description:
      "Toplanan veriler Gemini ile değerlendirilip admin onayına sunulacak.",
    status: "Planlandı",
  },
];

type AiSeoOpportunityPlaceholder = {
  title: string;
  description: string;
  status: string;
};

type AiSeoOpportunityItem = {
  type: string;
  priority: string;
  title: string;
  reason: string;
  sources: Array<{ name: string; url?: string }>;
  action?: string;
  status?: string;
};

function isValidOpportunityItem(item: unknown): item is AiSeoOpportunityItem {
  if (typeof item !== "object" || item === null) return false;
  const o = item as Record<string, unknown>;
  if (typeof o.title !== "string" || typeof o.reason !== "string")
    return false;
  if (!Array.isArray(o.sources) || o.sources.length === 0) return false;
  for (const s of o.sources) {
    if (typeof s !== "object" || s === null) return false;
    const src = s as Record<string, unknown>;
    if (typeof src.name !== "string" || !src.name.trim()) return false;
    if (
      src.url !== undefined &&
      src.url !== null &&
      typeof src.url !== "string"
    )
      return false;
  }
  return true;
}

type AiOpportunitySourcesPayload = {
  model: string;
  responseMimeType: "application/json";
  auditCheckedAt: string | null;
  summary: {
    score?: number;
    checkedUrls?: number;
    criticalIssues?: number;
    warnings?: number;
  } | null;
  issuesUsedCount: number;
  issuesUsed: Array<{
    severity?: string;
    title?: string;
    detail?: string;
    url?: string;
  }>;
  entrySeoUsedCount: number;
  entrySeoUsed: Array<{
    url?: string;
    title?: string | null;
    description?: string | null;
  }>;
};

function coerceAiSources(raw: unknown): AiOpportunitySourcesPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.model !== "string") return null;
  if (s.responseMimeType !== "application/json") return null;
  const auditCheckedAt =
    typeof s.auditCheckedAt === "string" || s.auditCheckedAt === null
      ? (s.auditCheckedAt as string | null)
      : null;
  const summary =
    s.summary === null || typeof s.summary === "object"
      ? (s.summary as AiOpportunitySourcesPayload["summary"])
      : null;
  const issuesUsed = Array.isArray(s.issuesUsed) ? s.issuesUsed : [];
  const entrySeoUsed = Array.isArray(s.entrySeoUsed) ? s.entrySeoUsed : [];
  const issuesUsedCount =
    typeof s.issuesUsedCount === "number"
      ? s.issuesUsedCount
      : issuesUsed.length;
  const entrySeoUsedCount =
    typeof s.entrySeoUsedCount === "number"
      ? s.entrySeoUsedCount
      : entrySeoUsed.length;
  return {
    model: s.model,
    responseMimeType: "application/json",
    auditCheckedAt,
    summary,
    issuesUsedCount,
    issuesUsed: issuesUsed.filter(
      (x): x is AiOpportunitySourcesPayload["issuesUsed"][number] =>
        typeof x === "object" && x !== null
    ),
    entrySeoUsedCount,
    entrySeoUsed: entrySeoUsed.filter(
      (x): x is AiOpportunitySourcesPayload["entrySeoUsed"][number] =>
        typeof x === "object" && x !== null
    ),
  };
}

const AI_SEO_OPPORTUNITY_PLACEHOLDERS: AiSeoOpportunityPlaceholder[] = [
  {
    title: "Yeni başlık fırsatları",
    description:
      "61Sözlük'e uygun, gündemle ilişkili yeni başlık önerileri burada görünecek.",
    status: "Gemini bağlantısı bekliyor",
  },
  {
    title: "Mevcut entry güçlendirme",
    description:
      "Meta description, iç link ve başlık iyileştirme önerileri burada listelenecek.",
    status: "Veri bekliyor",
  },
  {
    title: "Index fırsatları",
    description:
      "Sitemap'te olup Google görünürlüğü düşük URL'ler burada takip edilecek.",
    status: "Search Console bekliyor",
  },
];

type AuditCheckStatus = "pass" | "warning" | "fail";

type SeoAuditReport = {
  ok: true;
  checkedAt: string;
  auditRunId?: string | null;
  summary: {
    score: number;
    checkedUrls: number;
    criticalIssues: number;
    warnings: number;
  };
  checks: Array<{
    name: string;
    status: AuditCheckStatus;
    message: string;
  }>;
  issues: Array<{
    severity: "critical" | "warning";
    title: string;
    detail: string;
    url: string;
  }>;
};

type SeoAuditHistoryRow = {
  id: string;
  created_at: string;
  score: number;
  checked_urls: number;
  critical_issues: number;
  warnings: number;
};

function checkStatusClass(s: AuditCheckStatus): string {
  switch (s) {
    case "pass":
      return "border-emerald-500/35 bg-emerald-500/12 text-emerald-200";
    case "warning":
      return "border-amber-500/35 bg-amber-500/10 text-amber-100/95";
    case "fail":
      return "border-red-500/35 bg-red-500/12 text-red-200/95";
    default:
      return "border-slate-600 bg-slate-800/50 text-slate-400";
  }
}

function checkStatusLabel(s: AuditCheckStatus): string {
  switch (s) {
    case "pass":
      return "Tamam";
    case "warning":
      return "Uyarı";
    case "fail":
      return "Hata";
    default:
      return s;
  }
}

export default function SeoCommandCenterPage() {
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditReport, setAuditReport] = useState<SeoAuditReport | null>(null);
  const [auditHistory, setAuditHistory] = useState<SeoAuditHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [aiPrepLoading, setAiPrepLoading] = useState(false);
  const [aiPrepError, setAiPrepError] = useState<string | null>(null);
  const [aiPrepMessage, setAiPrepMessage] = useState<string | null>(null);
  const [aiPrepMode, setAiPrepMode] = useState<string | null>(null);
  const [aiSources, setAiSources] = useState<AiOpportunitySourcesPayload | null>(
    null
  );
  const [aiOpportunities, setAiOpportunities] = useState<AiSeoOpportunityItem[]>(
    []
  );

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/session", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        username?: string;
        role?: AdminRole;
      };
      if (!res.ok || !data.ok) {
        setSessionOk(false);
        setUsername(null);
        setRole(null);
        return;
      }
      if (data.role !== "super_admin" && data.role !== "editor_admin") {
        setSessionOk(false);
        setUsername(null);
        setRole(null);
        return;
      }
      setSessionOk(true);
      setUsername(typeof data.username === "string" ? data.username : null);
      setRole(data.role ?? null);
    } catch {
      setSessionOk(false);
      setUsername(null);
      setRole(null);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const loadAuditHistory = useCallback(async () => {
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/seo-command-center/history", {
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        runs?: SeoAuditHistoryRow[];
        error?: string;
      };
      if (!res.ok) {
        setHistoryError(
          typeof data.error === "string"
            ? data.error
            : "Geçmiş yüklenemedi."
        );
        setAuditHistory([]);
        return;
      }
      setAuditHistory(Array.isArray(data.runs) ? data.runs : []);
    } catch {
      setHistoryError("Ağ hatası.");
      setAuditHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionOk === true) {
      void loadAuditHistory();
    }
  }, [sessionOk, loadAuditHistory]);

  const runTechnicalAudit = useCallback(async () => {
    setAuditError(null);
    setAuditLoading(true);
    try {
      const res = await fetch("/api/admin/seo-command-center/run", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as
        | SeoAuditReport
        | { ok?: false; error?: string };
      if (!res.ok) {
        const err =
          typeof data === "object" &&
          data &&
          "error" in data &&
          typeof (data as { error?: string }).error === "string"
            ? (data as { error: string }).error
            : res.status === 401
              ? "Oturum gerekli veya yetkisiz."
              : "Tarama tamamlanamadı.";
        setAuditError(err);
        setAuditReport(null);
        return;
      }
      if (
        typeof data === "object" &&
        data &&
        data.ok === true &&
        "summary" in data &&
        "checks" in data
      ) {
        setAuditReport(data as SeoAuditReport);
        void loadAuditHistory();
      } else {
        setAuditError("Geçersiz yanıt.");
        setAuditReport(null);
      }
    } catch {
      setAuditError("Ağ hatası.");
      setAuditReport(null);
    } finally {
      setAuditLoading(false);
    }
  }, [loadAuditHistory]);

  const prepareAiOpportunities = useCallback(async () => {
    setAiPrepError(null);
    setAiPrepMessage(null);
    setAiPrepMode(null);
    setAiSources(null);
    setAiPrepLoading(true);
    try {
      const res = await fetch("/api/admin/seo-command-center/ai-opportunities", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        mode?: string;
        opportunities?: unknown;
        sources?: unknown;
      };
      const parsedSources = coerceAiSources(data.sources);

      if (res.status === 401) {
        setAiOpportunities([]);
        setAiPrepError(
          typeof data.error === "string"
            ? data.error
            : "Oturum gerekli veya yetkisiz."
        );
        return;
      }
      if (!res.ok) {
        setAiOpportunities([]);
        setAiPrepError(
          typeof data.error === "string"
            ? data.error
            : "AI fırsatları isteği tamamlanamadı."
        );
        if (parsedSources) setAiSources(parsedSources);
        return;
      }
      if (data.ok === false) {
        setAiOpportunities([]);
        setAiPrepError(
          typeof data.error === "string"
            ? data.error
            : "İstek reddedildi."
        );
        if (parsedSources) setAiSources(parsedSources);
        return;
      }
      const raw = data.opportunities;
      const list: AiSeoOpportunityItem[] = Array.isArray(raw)
        ? raw.filter(isValidOpportunityItem)
        : [];
      setAiOpportunities(list);
      setAiPrepError(null);
      setAiPrepMode(typeof data.mode === "string" ? data.mode : null);
      setAiPrepMessage(
        typeof data.message === "string" ? data.message : null
      );
      if (parsedSources) setAiSources(parsedSources);
    } catch {
      setAiOpportunities([]);
      setAiPrepError("Ağ hatası.");
    } finally {
      setAiPrepLoading(false);
    }
  }, []);

  if (sessionOk === null) {
    return (
      <main className="admin-page flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <p className="admin-loading-text">Oturum kontrol ediliyor…</p>
      </main>
    );
  }

  if (!sessionOk) {
    return (
      <main className="admin-page flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-200">
        <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center">
          <p className="admin-eyebrow">61Sözlük</p>
          <h1 className="mt-2 text-lg font-semibold text-slate-100">
            Bu alan için yönetim oturumu gerekir
          </h1>
          <p className="admin-helper mt-2 text-sm text-slate-400">
            SEO Komuta Merkezi yalnızca giriş yapmış yöneticiler içindir.
          </p>
          <Link
            href="/admin"
            className="admin-btn-text mt-6 inline-flex rounded-lg border border-slate-600 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
          >
            Yönetim paneline dön
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="admin-eyebrow">Yönetim paneli</p>
            <h1 className="admin-title-page">SEO Komuta Merkezi</h1>
            <p className="admin-session-line">
              Oturum:{" "}
              <span className="admin-session-val">{username ?? "—"}</span>
              {" · "}Rol:{" "}
              <span className="admin-session-val">
                {role === "super_admin"
                  ? "Tam yetki (super_admin)"
                  : role === "editor_admin"
                    ? "Editör (editor_admin)"
                    : "—"}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin"
              className="admin-btn-text rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"
            >
              ← Ana panel
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <p className="admin-helper max-w-3xl text-base leading-relaxed text-slate-300">
          {
            "61Sözlük'ün teknik SEO sağlığını, index fırsatlarını ve gündem uyumlu başlık önerilerini tek merkezden yönetmek için hazırlanıyor."
          }
        </p>

        <section
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-6"
          aria-label="SEO güncelle"
        >
          <button
            type="button"
            disabled={auditLoading}
            onClick={() => void runTechnicalAudit()}
            className="rounded-lg border border-emerald-600/50 bg-emerald-600/90 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {auditLoading ? "Taranıyor..." : "SEO GÜNCELLE"}
          </button>
          <p className="admin-helper mt-2 max-w-xl text-xs text-slate-500">
            Canlı site (https://61sozluk.com) için teknik SEO kontrollerini
            çalıştırır: ana sayfa, robots.txt, sitemap ve örnek entry URL’leri.
          </p>
          {auditError ? (
            <p
              className="admin-msg-error mt-3 text-sm text-[var(--accent)]"
              role="alert"
            >
              {auditError}
            </p>
          ) : null}
        </section>

        {auditReport ? (
          <section
            className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/35 p-6"
            aria-label="Teknik SEO raporu"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="admin-section-title text-base">
                  Teknik SEO raporu
                </h2>
                <p className="admin-helper mt-1 text-xs text-slate-500">
                  {new Date(auditReport.checkedAt).toLocaleString("tr-TR", {
                    dateStyle: "short",
                    timeStyle: "medium",
                  })}
                  {auditReport.auditRunId ? (
                    <>
                      {" · "}
                      <span className="font-mono text-[0.7rem] text-slate-600">
                        {auditReport.auditRunId}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>

            {auditReport.summary.criticalIssues === 0 ? (
              <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200/95">
                Kritik teknik SEO hatası bulunmadı.
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <p className="admin-stat-label text-[0.65rem]">SEO puanı</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-slate-100">
                  {auditReport.summary.score}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <p className="admin-stat-label text-[0.65rem]">
                  Kontrol edilen URL
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-slate-100">
                  {auditReport.summary.checkedUrls}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <p className="admin-stat-label text-[0.65rem]">Kritik</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-red-300/95">
                  {auditReport.summary.criticalIssues}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <p className="admin-stat-label text-[0.65rem]">Uyarı</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-amber-200/90">
                  {auditReport.summary.warnings}
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-200">
                Kontroller
              </h3>
              <ul className="m-0 list-none space-y-2 p-0">
                {auditReport.checks.map((c, idx) => (
                  <li
                    key={`${c.name}-${idx}`}
                    className="flex flex-wrap items-start gap-2 rounded-lg border border-slate-800/90 bg-slate-950/30 px-3 py-2.5"
                  >
                    <span
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${checkStatusClass(c.status)}`}
                    >
                      {checkStatusLabel(c.status)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-sm font-medium text-slate-100">
                        {c.name}
                      </p>
                      <p className="admin-helper m-0 mt-0.5 text-xs leading-relaxed text-slate-400">
                        {c.message}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-200">
                Sorunlar
              </h3>
              {auditReport.issues.length === 0 ? (
                <p className="admin-helper m-0 text-sm text-slate-500">
                  Liste boş — raporlanan sorun yok.
                </p>
              ) : (
                <ul className="m-0 list-none space-y-2 p-0">
                  {auditReport.issues.map((issue, idx) => (
                    <li
                      key={`${issue.url}-${idx}`}
                      className="rounded-lg border border-slate-800/90 bg-slate-950/30 px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            issue.severity === "critical"
                              ? "rounded border border-red-500/35 bg-red-500/12 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-red-200/95"
                              : "rounded border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-100/90"
                          }
                        >
                          {issue.severity === "critical" ? "Kritik" : "Uyarı"}
                        </span>
                        <span className="text-sm font-medium text-slate-100">
                          {issue.title}
                        </span>
                      </div>
                      <p className="admin-helper m-0 mt-1 text-xs leading-relaxed text-slate-400">
                        {issue.detail}
                      </p>
                      <p className="m-0 mt-1 break-all font-mono text-[0.7rem] text-slate-500">
                        {issue.url}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ) : null}

        <section
          className="rounded-xl border border-slate-800 bg-slate-900/35 p-6"
          aria-label="Son SEO taramaları"
        >
          <h2 className="admin-section-title text-base">Son SEO Taramaları</h2>
          {historyError ? (
            <p className="admin-msg-error mt-2 text-sm text-[var(--accent)]">
              {historyError}
            </p>
          ) : null}
          {historyLoading && auditHistory.length === 0 && !historyError ? (
            <p className="admin-helper mt-3 text-sm text-slate-500">
              Geçmiş yükleniyor…
            </p>
          ) : null}
          {!historyLoading && auditHistory.length === 0 && !historyError ? (
            <p className="admin-helper mt-3 text-sm text-slate-500">
              Henüz kayıtlı SEO taraması yok.
            </p>
          ) : null}
          {auditHistory.length > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800/90">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50">
                    <th className="admin-th px-3 py-2.5 font-medium text-slate-400">
                      Tarih
                    </th>
                    <th className="admin-th px-3 py-2.5 font-medium text-slate-400">
                      SEO puanı
                    </th>
                    <th className="admin-th px-3 py-2.5 font-medium text-slate-400">
                      URL
                    </th>
                    <th className="admin-th px-3 py-2.5 font-medium text-slate-400">
                      Kritik
                    </th>
                    <th className="admin-th px-3 py-2.5 font-medium text-slate-400">
                      Uyarı
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {auditHistory.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-800/70 last:border-0 hover:bg-slate-900/40"
                    >
                      <td className="admin-td whitespace-nowrap px-3 py-2 text-slate-300">
                        {new Date(row.created_at).toLocaleString("tr-TR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="admin-td px-3 py-2 tabular-nums text-slate-100">
                        {row.score}
                      </td>
                      <td className="admin-td px-3 py-2 tabular-nums text-slate-300">
                        {row.checked_urls}
                      </td>
                      <td className="admin-td px-3 py-2 tabular-nums text-red-300/90">
                        {row.critical_issues}
                      </td>
                      <td className="admin-td px-3 py-2 tabular-nums text-amber-200/85">
                        {row.warnings}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <section
          className="rounded-xl border border-slate-800 bg-slate-900/35 p-6"
          aria-label="AI SEO fırsatları"
        >
          <h2 className="admin-section-title text-base">AI SEO Fırsatları</h2>
          {aiPrepMode === "live" ? (
            <p className="admin-helper mt-2 text-xs font-medium text-sky-300/90">
              Gemini tarafından analiz edildi
            </p>
          ) : null}
          <p className="admin-helper mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Gündem, Search Console ve teknik SEO verileri Gemini ile analiz
            edildiğinde öneriler burada listelenecek.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={aiPrepLoading}
              onClick={() => void prepareAiOpportunities()}
              className="rounded-lg border border-sky-600/45 bg-sky-600/85 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {aiPrepLoading ? "Hazırlanıyor..." : "AI FIRSATLARI HAZIRLA"}
            </button>
          </div>
          {aiPrepError ? (
            <p
              className="admin-msg-error mt-3 text-sm text-[var(--accent)]"
              role="alert"
            >
              {aiPrepError}
            </p>
          ) : null}
          {aiPrepMessage ? (
            <p className="admin-helper mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-2 text-sm text-emerald-200/90">
              {aiPrepMessage}
            </p>
          ) : null}
          {aiSources ? (
            <div
              className="mt-4 rounded-lg border border-slate-800 bg-slate-950/35 p-4"
              aria-label="Analiz kaynakları"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Analiz kaynakları
              </h3>
              <dl className="admin-helper mt-3 space-y-2 text-xs leading-relaxed text-slate-400">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-slate-500">Gemini modeli</dt>
                  <dd className="font-mono text-slate-300">{aiSources.model}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-slate-500">Çıktı formatı</dt>
                  <dd className="font-mono text-slate-300">
                    {aiSources.responseMimeType}
                  </dd>
                </div>
                {aiSources.auditCheckedAt ? (
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-medium text-slate-500">
                      SEO tarama zamanı
                    </dt>
                    <dd className="text-slate-300">
                      {new Date(aiSources.auditCheckedAt).toLocaleString(
                        "tr-TR",
                        { dateStyle: "short", timeStyle: "medium" }
                      )}
                    </dd>
                  </div>
                ) : (
                  <div className="text-slate-500">
                    Kayıtlı tarama zamanı bulunamadı (henüz tarama yok veya
                    geçmiş okunamadı).
                  </div>
                )}
              </dl>
              {aiSources.summary ? (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded border border-slate-800/90 bg-slate-900/40 px-2 py-1.5">
                    <p className="admin-stat-label text-[0.6rem]">Puan</p>
                    <p className="tabular-nums text-slate-200">
                      {aiSources.summary.score ?? "—"}
                    </p>
                  </div>
                  <div className="rounded border border-slate-800/90 bg-slate-900/40 px-2 py-1.5">
                    <p className="admin-stat-label text-[0.6rem]">URL</p>
                    <p className="tabular-nums text-slate-200">
                      {aiSources.summary.checkedUrls ?? "—"}
                    </p>
                  </div>
                  <div className="rounded border border-slate-800/90 bg-slate-900/40 px-2 py-1.5">
                    <p className="admin-stat-label text-[0.6rem]">Kritik</p>
                    <p className="tabular-nums text-slate-200">
                      {aiSources.summary.criticalIssues ?? "—"}
                    </p>
                  </div>
                  <div className="rounded border border-slate-800/90 bg-slate-900/40 px-2 py-1.5">
                    <p className="admin-stat-label text-[0.6rem]">Uyarı</p>
                    <p className="tabular-nums text-slate-200">
                      {aiSources.summary.warnings ?? "—"}
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-500">
                  Prompt’a dahil edilen sorunlar ({aiSources.issuesUsedCount})
                </p>
                {aiSources.issuesUsed.length === 0 ? (
                  <p className="admin-helper mt-1 text-xs text-slate-600">
                    Yok.
                  </p>
                ) : (
                  <ul className="m-0 mt-1 max-h-40 list-none space-y-1 overflow-y-auto p-0">
                    {aiSources.issuesUsed.map((issue, idx) => (
                      <li
                        key={`src-issue-${idx}`}
                        className="rounded border border-slate-800/80 bg-slate-900/30 px-2 py-1.5 text-[0.7rem] text-slate-400"
                      >
                        <span className="text-slate-300">
                          {issue.title ?? "—"}
                        </span>
                        {issue.url ? (
                          <span className="mt-0.5 block break-all font-mono text-[0.65rem] text-slate-600">
                            {issue.url}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-500">
                  Prompt’a dahil entry SEO örnekleri (
                  {aiSources.entrySeoUsedCount})
                </p>
                {aiSources.entrySeoUsed.length === 0 ? (
                  <p className="admin-helper mt-1 text-xs text-slate-600">
                    Yok.
                  </p>
                ) : (
                  <ul className="m-0 mt-1 max-h-40 list-none space-y-1 overflow-y-auto p-0">
                    {aiSources.entrySeoUsed.map((row, idx) => (
                      <li
                        key={`src-entry-${idx}`}
                        className="rounded border border-slate-800/80 bg-slate-900/30 px-2 py-1.5 text-[0.7rem] text-slate-400"
                      >
                        <span className="break-all font-mono text-[0.65rem] text-slate-500">
                          {row.url ?? "—"}
                        </span>
                        {(row.title != null && row.title !== "") ||
                        (row.description != null &&
                          row.description !== "") ? (
                          <span className="mt-0.5 block space-y-0.5 text-slate-400">
                            {row.title != null && row.title !== "" ? (
                              <span className="block">
                                Başlık:{" "}
                                {row.title.length > 120
                                  ? `${row.title.slice(0, 120)}…`
                                  : row.title}
                              </span>
                            ) : null}
                            {row.description != null &&
                            row.description !== "" ? (
                              <span className="block text-slate-500">
                                Meta:{" "}
                                {row.description.length > 120
                                  ? `${row.description.slice(0, 120)}…`
                                  : row.description}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
          {aiOpportunities.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {aiOpportunities.map((opp, idx) => (
                <article
                  key={`${opp.type}-${idx}`}
                  className="rounded-xl border border-slate-700/90 bg-slate-950/40 p-4 shadow-none"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-100">
                      {opp.title}
                    </h3>
                    <span className="shrink-0 rounded-full border border-slate-600/90 bg-slate-900/60 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-300">
                      {opp.priority === "high"
                        ? "Öncelik: yüksek"
                        : opp.priority === "medium"
                          ? "Öncelik: orta"
                          : opp.priority === "low"
                            ? "Öncelik: düşük"
                            : opp.priority}
                    </span>
                  </div>
                  <p className="admin-helper mt-2 text-xs text-slate-500">
                    {opp.type}
                  </p>
                  <p className="admin-helper mt-2 text-sm leading-relaxed text-slate-400">
                    {opp.reason}
                  </p>
                  {opp.action ? (
                    <p className="admin-helper mt-2 text-xs leading-relaxed text-slate-300">
                      Önerilen aksiyon: {opp.action}
                    </p>
                  ) : null}
                  {opp.sources.length > 0 ? (
                    <div className="mt-3 border-t border-slate-800/80 pt-2">
                      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">
                        Kaynaklar
                      </p>
                      <ul className="m-0 mt-1 list-none space-y-1 p-0">
                        {opp.sources.map((src, srcIdx) => (
                          <li
                            key={`${opp.type}-${idx}-src-${srcIdx}`}
                            className="text-[0.7rem] leading-snug text-slate-400"
                          >
                            {typeof src.url === "string" &&
                            src.url.trim().length > 0 ? (
                              <a
                                href={src.url.trim()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-400/95 underline-offset-2 hover:underline"
                              >
                                {src.name}
                              </a>
                            ) : (
                              <span>{src.name}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {opp.status ? (
                    <p className="admin-helper mt-3 text-[0.7rem] uppercase tracking-wide text-slate-500">
                      Durum: {opp.status}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
          {!aiPrepLoading && aiOpportunities.length === 0 && !aiPrepError ? (
            <p className="admin-helper mt-4 rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2.5 text-sm text-slate-500">
              Henüz AI SEO fırsatı üretilmedi.
            </p>
          ) : null}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {AI_SEO_OPPORTUNITY_PLACEHOLDERS.map((card) => (
              <article
                key={card.title}
                aria-disabled="true"
                className="rounded-xl border border-dashed border-slate-700/90 bg-slate-950/25 p-5 opacity-85 shadow-none"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-200">
                    {card.title}
                  </h3>
                  <span className="shrink-0 rounded-full border border-slate-700/90 bg-slate-950/50 px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">
                    {card.status}
                  </span>
                </div>
                <p className="admin-helper mt-3 text-sm leading-relaxed text-slate-500">
                  {card.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section aria-label="SEO modülleri">
          <h2 className="admin-section-title mb-4 text-base">Modüller</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SEO_MODULES.map((m) => (
              <article
                key={m.title}
                className="rounded-xl border border-slate-800 bg-slate-900/35 p-5 shadow-none"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">
                    {m.title}
                  </h3>
                  <span className="shrink-0 rounded-full border border-slate-700/90 bg-slate-950/50 px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">
                    {m.status}
                  </span>
                </div>
                <p className="admin-helper mt-3 text-sm leading-relaxed text-slate-400">
                  {m.description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
