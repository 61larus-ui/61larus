"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AdminRole } from "@/lib/admin-role";

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

type AcademicEntrySuggestion = {
  suggestedEntryTitle: string;
  suggestedEntryDescription: string;
  reason: string;
  sources: string[];
  sourceNote: string;
  confidence: string;
  categorySuggestion: string;
  duplicateRisk: string;
};

function isValidAcademicEntrySuggestion(
  item: unknown
): item is AcademicEntrySuggestion {
  if (typeof item !== "object" || item === null) return false;
  const o = item as Record<string, unknown>;
  if (typeof o.suggestedEntryTitle !== "string") return false;
  if (typeof o.suggestedEntryDescription !== "string") return false;
  if (typeof o.reason !== "string") return false;
  if (typeof o.sourceNote !== "string") return false;
  if (typeof o.confidence !== "string") return false;
  if (typeof o.categorySuggestion !== "string") return false;
  if (typeof o.duplicateRisk !== "string") return false;
  if (!Array.isArray(o.sources) || !o.sources.every((x) => typeof x === "string"))
    return false;
  return true;
}

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

function looksLikeUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

function confidenceLabel(c: string): string {
  switch (c) {
    case "high":
      return "yüksek";
    case "medium":
      return "orta";
    case "low":
      return "düşük";
    default:
      return c;
  }
}

function duplicateRiskLabel(r: string): string {
  switch (r) {
    case "high":
      return "yüksek";
    case "medium":
      return "orta";
    case "low":
      return "düşük";
    default:
      return r;
  }
}

function categorySuggestionLabel(c: string): string {
  switch (c) {
    case "tarih":
      return "tarih";
    case "kultur":
      return "kültür";
    case "sehir":
      return "şehir";
    case "akademik":
      return "akademik";
    case "siyaset":
      return "siyaset";
    case "ekonomi":
      return "ekonomi";
    case "toplum":
      return "toplum";
    default:
      return c;
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

  const [academicLoading, setAcademicLoading] = useState(false);
  const [academicError, setAcademicError] = useState<string | null>(null);
  const [academicMessage, setAcademicMessage] = useState<string | null>(null);
  const [academicGeminiBanner, setAcademicGeminiBanner] = useState<
    string | null
  >(null);
  const [academicSuggestions, setAcademicSuggestions] = useState<
    AcademicEntrySuggestion[] | null
  >(null);

  const [gscTestLoading, setGscTestLoading] = useState(false);
  const [gscTestBanner, setGscTestBanner] = useState<
    | { kind: "ok"; siteUrl?: string }
    | { kind: "err"; message: string; missing: string[] }
    | null
  >(null);

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

  const fetchAcademicSuggestions = useCallback(async () => {
    setAcademicError(null);
    setAcademicMessage(null);
    setAcademicGeminiBanner(null);
    setAcademicSuggestions(null);
    setAcademicLoading(true);
    try {
      const res = await fetch(
        "/api/admin/seo-command-center/trabzon-agenda",
        { method: "GET", credentials: "include" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        suggestions?: unknown;
        error?: string;
      };
      if (res.status === 401) {
        setAcademicError(
          typeof data.error === "string"
            ? data.error
            : "Oturum gerekli veya yetkisiz."
        );
        return;
      }
      if (!res.ok) {
        setAcademicError(
          typeof data.error === "string"
            ? data.error
            : "İstek tamamlanamadı."
        );
        return;
      }
      if (data.ok !== true) {
        setAcademicError(
          typeof data.error === "string" ? data.error : "Yanıt reddedildi."
        );
        return;
      }
      setAcademicMessage(typeof data.message === "string" ? data.message : null);
      const raw = Array.isArray(data.suggestions) ? data.suggestions : [];
      setAcademicSuggestions(raw.filter(isValidAcademicEntrySuggestion));
      const warn =
        typeof data.error === "string" && data.error.trim()
          ? data.error.trim()
          : null;
      setAcademicGeminiBanner(warn);
    } catch {
      setAcademicError("Ağ hatası.");
    } finally {
      setAcademicLoading(false);
    }
  }, []);

  const testGscConnection = useCallback(async () => {
    setGscTestBanner(null);
    setGscTestLoading(true);
    try {
      const res = await fetch(
        "/api/admin/seo-command-center/search-console/test",
        { method: "POST", credentials: "include" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        missing?: string[];
        message?: string;
        siteUrl?: string;
      };
      if (res.status === 401) {
        setGscTestBanner({
          kind: "err",
          message:
            typeof data.message === "string"
              ? data.message
              : "Oturum gerekli veya yetkisiz.",
          missing: [],
        });
        return;
      }
      if (data.ok === true) {
        setGscTestBanner({
          kind: "ok",
          siteUrl:
            typeof data.siteUrl === "string" && data.siteUrl.trim()
              ? data.siteUrl.trim()
              : undefined,
        });
        return;
      }
      setGscTestBanner({
        kind: "err",
        message:
          typeof data.message === "string"
            ? data.message
            : "Bağlantı testi tamamlanamadı.",
        missing: Array.isArray(data.missing) ? data.missing : [],
      });
    } catch {
      setGscTestBanner({
        kind: "err",
        message: "Ağ hatası.",
        missing: [],
      });
    } finally {
      setGscTestLoading(false);
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

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <p className="admin-helper max-w-3xl text-base leading-relaxed text-slate-300">
          Bu ekrandan canlı site için teknik SEO denetimi çalıştırılır; ayrıca
          akademik içerik fırsatları için Gemini önerileri alınır. Öneriler
          otomatik yayınlanmaz.
        </p>

        <section
          className="space-y-8 rounded-xl border border-slate-800 bg-slate-900/40 p-6"
          aria-label="SEO denetimi"
        >
          <h2 className="admin-section-title m-0 text-lg">SEO denetimi</h2>

          <div aria-label="Teknik SEO taraması">
            <button
              type="button"
              disabled={auditLoading}
              onClick={() => void runTechnicalAudit()}
              className="rounded-lg border border-emerald-600/50 bg-emerald-600/90 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {auditLoading ? "Taranıyor..." : "SEO GÜNCELLE"}
            </button>
            <p className="admin-helper mt-2 max-w-xl text-xs text-slate-500">
              Canlı site (https://61sozluk.com) için ana sayfa, robots.txt,
              sitemap ve örnek entry URL kontrollerini çalıştırır.
            </p>
            {auditError ? (
              <p
                className="admin-msg-error mt-3 text-sm text-[var(--accent)]"
                role="alert"
              >
                {auditError}
              </p>
            ) : null}
          </div>

          <div aria-label="Google index iletişimi">
            <h3 className="admin-section-title text-base">
              Google index iletişimi
            </h3>
            <ul className="admin-helper m-0 mt-3 list-none space-y-2.5 p-0 text-sm leading-relaxed text-slate-400">
              <li className="flex gap-2">
                <span className="text-slate-600" aria-hidden>
                  ·
                </span>
                <span>
                  Sitemap:{" "}
                  <a
                    href="https://61sozluk.com/sitemap.xml"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all font-mono text-[0.8rem] text-sky-400/95 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
                  >
                    https://61sozluk.com/sitemap.xml
                  </a>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-slate-600" aria-hidden>
                  ·
                </span>
                <span>Yeni entry sonrası sitemap bildirimi gönderilir.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-slate-600" aria-hidden>
                  ·
                </span>
                <span>Pending içerik bildirilmez; index garantisi yoktur.</span>
              </li>
            </ul>
          </div>

          <div aria-label="Google Search Console">
            <h3 className="admin-section-title text-base">
              Google Search Console
            </h3>
            <p className="admin-helper mt-2 max-w-2xl text-sm text-slate-400">
              OAuth bağlantısı ve sunucu değişkenleri diğer yönetim akışlarında
              kullanılır; burada yalnızca sunucu tarafı yapılandırma kontrolü
              vardır.
            </p>
            <button
              type="button"
              disabled={gscTestLoading}
              onClick={() => void testGscConnection()}
              className="mt-3 rounded-lg border border-slate-600 bg-slate-950/60 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {gscTestLoading
                ? "Kontrol ediliyor..."
                : "Sunucu yapılandırmasını kontrol et"}
            </button>
            {gscTestBanner?.kind === "ok" ? (
              <div
                className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-200/95"
                role="status"
              >
                <p className="m-0">
                  GSC ile ilgili ek yapılandırma tanımlı görünüyor.
                </p>
                {gscTestBanner.siteUrl ? (
                  <p className="admin-helper m-0 mt-1 break-all font-mono text-[0.65rem] text-emerald-300/85">
                    {gscTestBanner.siteUrl}
                  </p>
                ) : null}
              </div>
            ) : null}
            {gscTestBanner?.kind === "err" ? (
              <div
                className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95"
                role="alert"
              >
                <p className="m-0 break-words">{gscTestBanner.message}</p>
                {gscTestBanner.missing.length > 0 ? (
                  <ul className="mb-0 mt-2 list-disc pl-4">
                    {gscTestBanner.missing.map((key) => (
                      <li
                        key={key}
                        className="break-all font-mono text-[0.65rem] text-amber-50/90"
                      >
                        {key}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          {auditReport ? (
            <div className="space-y-6 border-t border-slate-800/80 pt-8">
              <div>
                <h3 className="admin-section-title m-0 text-base">
                  Teknik SEO raporu
                </h3>
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
                    Kontrol URL
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
                <h4 className="mb-2 text-sm font-semibold text-slate-200">
                  Kontroller
                </h4>
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
                <h4 className="mb-2 text-sm font-semibold text-slate-200">
                  Sorunlar
                </h4>
                {auditReport.issues.length === 0 ? (
                  <p className="admin-helper m-0 text-sm text-slate-500">
                    Liste boş.
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
            </div>
          ) : null}

          <div className="border-t border-slate-800/80 pt-8">
            <h3 className="admin-section-title m-0 text-base">
              Son SEO taramaları
            </h3>
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
            {!historyLoading &&
            auditHistory.length === 0 &&
            !historyError ? (
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
          </div>
        </section>

        <section
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-6"
          aria-label="Günlük 8 akademik entry önerisi"
        >
          <h2 className="admin-section-title m-0 text-lg">
            Günlük 8 akademik entry önerisi
          </h2>
          <p className="admin-helper mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
            Gemini, Trabzon hakkında akademik ve açık kaynaklı konuları tarama
            mantığıyla entry başlığı, açıklama ve kaynak önerir. Öneriler
            otomatik yayınlanmaz.
          </p>
          <button
            type="button"
            disabled={academicLoading}
            onClick={() => void fetchAcademicSuggestions()}
            className="mt-4 rounded-lg border border-sky-600/45 bg-sky-600/85 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {academicLoading ? "Üretiliyor..." : "8 entry önerisi üret"}
          </button>

          {academicError ? (
            <p
              className="admin-msg-error mt-3 text-sm text-[var(--accent)]"
              role="alert"
            >
              {academicError}
            </p>
          ) : null}
          {academicGeminiBanner ? (
            <p
              className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95"
              role="status"
            >
              {academicGeminiBanner}
            </p>
          ) : null}
          {academicMessage ? (
            <p className="admin-helper mt-3 text-sm text-slate-300">
              {academicMessage}
            </p>
          ) : null}

          {academicSuggestions && academicSuggestions.length > 0 ? (
            <ul className="m-0 mt-6 list-none space-y-4 p-0">
              {academicSuggestions.map((s, i) => (
                <li
                  key={`${s.suggestedEntryTitle}-${i}`}
                  className="rounded-xl border border-slate-700/85 bg-slate-950/45 p-4 text-sm shadow-none"
                >
                  <p className="m-0 text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">
                    Entry başlığı
                  </p>
                  <p className="m-0 mt-0.5 font-semibold text-slate-100">
                    {s.suggestedEntryTitle}
                  </p>

                  <p className="m-0 mt-4 text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">
                    Admin açıklaması
                  </p>
                  <p className="admin-helper m-0 mt-0.5 text-xs leading-relaxed text-slate-300">
                    {s.suggestedEntryDescription}
                  </p>

                  <p className="m-0 mt-4 text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">
                    Neden önerildi?
                  </p>
                  <p className="admin-helper m-0 mt-0.5 text-xs leading-relaxed text-slate-400">
                    {s.reason}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-slate-400">
                    <span>
                      Kategori önerisi:{" "}
                      <span className="text-slate-200">
                        {categorySuggestionLabel(s.categorySuggestion)}
                      </span>
                    </span>
                    <span>
                      Güven seviyesi:{" "}
                      <span className="text-slate-200">
                        {confidenceLabel(s.confidence)}
                      </span>
                    </span>
                    <span>
                      Tekrar riski:{" "}
                      <span className="text-slate-200">
                        {duplicateRiskLabel(s.duplicateRisk)}
                      </span>
                    </span>
                  </div>

                  <p className="m-0 mt-4 text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">
                    Kaynaklar
                  </p>
                  {s.sources.length === 0 ? (
                    <p className="admin-helper m-0 mt-1 text-xs text-slate-500">
                      (Boş — doğrulama gerekli)
                    </p>
                  ) : (
                    <ul className="admin-helper m-0 mt-1 list-none space-y-1 p-0 text-xs leading-relaxed text-slate-400">
                      {s.sources.map((src, idx) => (
                        <li key={`${idx}-${src.slice(0, 48)}`}>
                          {looksLikeUrl(src) ? (
                            <a
                              href={src.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="break-all text-sky-400/95 underline underline-offset-2 hover:text-sky-300"
                            >
                              {src.trim()}
                            </a>
                          ) : (
                            <span className="break-words">{src}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="m-0 mt-4 text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">
                    Kaynak notu
                  </p>
                  <p className="admin-helper m-0 mt-0.5 text-xs text-slate-500">
                    {s.sourceNote}
                  </p>

                  <p className="admin-helper m-0 mt-4 rounded-md border border-slate-700/60 bg-slate-900/55 px-2.5 py-2 text-[0.7rem] leading-snug text-slate-400">
                    Bu açıklama sadece admin panelinde görünür. Yayın için
                    kategori seçimi ve admin onayı gerekir.
                  </p>
                </li>
              ))}
            </ul>
          ) : null}

          {academicSuggestions !== null && academicSuggestions.length === 0 ? (
            <p className="admin-helper mt-4 text-sm text-slate-500">
              Bu çağrıda öneri dönmedi. Gemini anahtarını ve kota/limitleri
              kontrol edin.
            </p>
          ) : null}

          <p className="admin-helper mt-6 text-[0.7rem] leading-relaxed text-slate-600">
            Sonraki faz: Admin kategori seçimi ve tek tıkla canlı yayına alma —
            henüz uygulanmadı.
          </p>
        </section>
      </div>
    </main>
  );
}
