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
      "Canlı sitede ana sayfa, robots.txt, sitemap ve örnek entry URL kontrolleri çalışır. Google index garantisi değil; güncel sitemap bildirimi yapılır.",
    status: "Sitemap bildirimi aktif",
  },
  {
    title: "Google Search Console bağlantısı",
    description:
      "OAuth bağlantısı aktifse öneri motoru GSC verisini kullanır. İsteğe bağlı sunucu kontrolü kartın altındadır.",
    status: "OAuth ile kullanım",
  },
  {
    title: "Gündem motoru",
    description:
      "Trend ve gündemden başlık önerileri için planlı geliştirme.",
    status: "Planlı",
  },
  {
    title: "Gemini analizi",
    description:
      "Öneriler Gemini ile üretilir; teknik tarama ve isteğe bağlı GSC örnekleriyle beslenir.",
    status: "Aktif",
  },
];

const GSC_MODULE_TITLE = "Google Search Console bağlantısı";

type SeoRecommendationItem = {
  title: string;
  reason: string;
  suggestedEntryTitle: string;
  priority: string;
  sourceType: string;
  sources: string[];
  sourceNote: string;
  confidence: string;
};

function isValidSeoRecommendation(item: unknown): item is SeoRecommendationItem {
  if (typeof item !== "object" || item === null) return false;
  const o = item as Record<string, unknown>;
  if (typeof o.title !== "string" || typeof o.reason !== "string") return false;
  if (typeof o.suggestedEntryTitle !== "string") return false;
  if (!Array.isArray(o.sources)) return false;
  if (!o.sources.every((s) => typeof s === "string")) return false;
  if (typeof o.sourceNote !== "string") return false;
  if (typeof o.priority !== "string") return false;
  if (typeof o.sourceType !== "string") return false;
  if (typeof o.confidence !== "string") return false;
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
  gscConnected: boolean;
  gscDataAvailable: boolean;
  gscQueriesSample: string[];
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
  const gscQueriesSample = Array.isArray(s.gscQueriesSample)
    ? s.gscQueriesSample.filter((x): x is string => typeof x === "string")
    : [];
  const gscConnected =
    typeof s.gscConnected === "boolean" ? s.gscConnected : false;
  const gscDataAvailable =
    typeof s.gscDataAvailable === "boolean" ? s.gscDataAvailable : false;
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
    gscConnected,
    gscDataAvailable,
    gscQueriesSample,
  };
}

function sourceTypeLabel(t: string): string {
  switch (t) {
    case "gsc":
      return "Search Console";
    case "technical_audit":
      return "Teknik audit";
    case "content_gap":
      return "İçerik fırsatı";
    case "academic_source_required":
      return "Kaynak doğrulaması gerekli";
    default:
      return t;
  }
}

function priorityLabel(p: string): string {
  switch (p) {
    case "high":
      return "yüksek";
    case "medium":
      return "orta";
    case "low":
      return "düşük";
    default:
      return p;
  }
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

function looksLikeUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

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

type TrabzonAgendaSuggestion = {
  title: string;
  reason: string;
  suggestedEntryTitle: string;
  suggestedEntryDescription: string;
  sourceIds: string[];
  sourceNote: string;
  confidence: string;
  category: string;
  siteDuplicateRisk: string;
};

function isValidTrabzonAgendaSuggestion(
  item: unknown
): item is TrabzonAgendaSuggestion {
  if (typeof item !== "object" || item === null) return false;
  const o = item as Record<string, unknown>;
  if (typeof o.title !== "string" || typeof o.reason !== "string") return false;
  if (typeof o.suggestedEntryTitle !== "string") return false;
  if (typeof o.suggestedEntryDescription !== "string") return false;
  if (typeof o.sourceNote !== "string") return false;
  if (typeof o.confidence !== "string" || typeof o.category !== "string")
    return false;
  if (typeof o.siteDuplicateRisk !== "string") return false;
  if (!Array.isArray(o.sourceIds) || !o.sourceIds.every((x) => typeof x === "string"))
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
  const [aiOpportunities, setAiOpportunities] = useState<SeoRecommendationItem[]>(
    []
  );
  const [gscTrustLines, setGscTrustLines] = useState<string[] | null>(null);
  const [gscTestLoading, setGscTestLoading] = useState(false);
  const [gscTestBanner, setGscTestBanner] = useState<
    | { kind: "ok"; siteUrl?: string }
    | { kind: "err"; message: string; missing: string[] }
    | null
  >(null);
  const [agendaCheckLoading, setAgendaCheckLoading] = useState(false);
  const [agendaCheckError, setAgendaCheckError] = useState<string | null>(null);
  const [agendaMessage, setAgendaMessage] = useState<string | null>(null);
  const [agendaPrinciples, setAgendaPrinciples] = useState<string[] | null>(
    null
  );
  const [agendaSourcePlan, setAgendaSourcePlan] = useState<
    Array<{ type: string; label: string; status: string }> | null
  >(null);
  const [agendaSuggestions, setAgendaSuggestions] = useState<
    TrabzonAgendaSuggestion[] | null
  >(null);
  const [agendaGeminiWarning, setAgendaGeminiWarning] = useState<string | null>(
    null
  );
  const [agendaSourcesPreview, setAgendaSourcesPreview] = useState<
    Array<{ label: string; type: string; trustLevel: string }> | null
  >(null);
  const [xSignalsCheckLoading, setXSignalsCheckLoading] = useState(false);
  const [xSignalsCheckError, setXSignalsCheckError] = useState<string | null>(
    null
  );
  const [xSignalsMessage, setXSignalsMessage] = useState<string | null>(null);
  const [xSignalsPrinciples, setXSignalsPrinciples] = useState<string[] | null>(
    null
  );
  const [xSignalsSignalPlan, setXSignalsSignalPlan] = useState<
    Array<{ type: string; label: string; status: string }> | null
  >(null);
  const [xSignalsEmpty, setXSignalsEmpty] = useState<boolean | null>(null);

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
    setGscTrustLines(null);
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
        gscTrust?: {
          connected?: boolean;
          dataAvailable?: boolean;
          lines?: unknown;
          message?: string;
        };
      };
      const parsedSources = coerceAiSources(data.sources);

      const trustLinesFromApi = (): string[] | null => {
        const gt = data.gscTrust;
        if (
          gt &&
          Array.isArray(gt.lines) &&
          gt.lines.every((x) => typeof x === "string")
        ) {
          return gt.lines as string[];
        }
        if (gt && typeof gt.message === "string" && gt.message.trim()) {
          return [gt.message.trim()];
        }
        return null;
      };

      if (res.status === 401) {
        setAiOpportunities([]);
        setGscTrustLines(trustLinesFromApi());
        setAiPrepError(
          typeof data.error === "string"
            ? data.error
            : "Oturum gerekli veya yetkisiz."
        );
        return;
      }
      if (!res.ok) {
        setAiOpportunities([]);
        setGscTrustLines(trustLinesFromApi());
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
        setGscTrustLines(trustLinesFromApi());
        setAiPrepError(
          typeof data.error === "string"
            ? data.error
            : "İstek reddedildi."
        );
        if (parsedSources) setAiSources(parsedSources);
        return;
      }
      const raw = data.opportunities;
      const list: SeoRecommendationItem[] = Array.isArray(raw)
        ? raw.filter(isValidSeoRecommendation)
        : [];
      setAiOpportunities(list);
      setGscTrustLines(trustLinesFromApi());
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

  const checkTrabzonAgenda = useCallback(async () => {
    setAgendaCheckError(null);
    setAgendaMessage(null);
    setAgendaPrinciples(null);
    setAgendaSourcePlan(null);
    setAgendaSuggestions(null);
    setAgendaGeminiWarning(null);
    setAgendaSourcesPreview(null);
    setAgendaCheckLoading(true);
    try {
      const res = await fetch(
        "/api/admin/seo-command-center/trabzon-agenda",
        { method: "GET", credentials: "include" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        principles?: unknown;
        sourcePlan?: unknown;
        sources?: unknown;
        suggestions?: unknown;
        error?: string;
      };
      if (res.status === 401) {
        setAgendaCheckError(
          typeof data.error === "string"
            ? data.error
            : "Oturum gerekli veya yetkisiz."
        );
        return;
      }
      if (!res.ok) {
        setAgendaCheckError(
          typeof data.error === "string"
            ? data.error
            : "İstek tamamlanamadı."
        );
        return;
      }
      if (data.ok !== true) {
        setAgendaCheckError(
          typeof data.error === "string" ? data.error : "Yanıt reddedildi."
        );
        return;
      }
      setAgendaMessage(typeof data.message === "string" ? data.message : null);
      const principles = Array.isArray(data.principles)
        ? data.principles.filter((x): x is string => typeof x === "string")
        : [];
      setAgendaPrinciples(principles);
      const rawPlan = Array.isArray(data.sourcePlan) ? data.sourcePlan : [];
      const plan: Array<{ type: string; label: string; status: string }> = [];
      for (const row of rawPlan) {
        if (typeof row !== "object" || row === null) continue;
        const r = row as Record<string, unknown>;
        plan.push({
          type: typeof r.type === "string" ? r.type : "—",
          label: typeof r.label === "string" ? r.label : "—",
          status: typeof r.status === "string" ? r.status : "—",
        });
      }
      setAgendaSourcePlan(plan);
      const rawSources = Array.isArray(data.sources) ? data.sources : [];
      const preview: Array<{ label: string; type: string; trustLevel: string }> =
        [];
      for (const row of rawSources.slice(0, 3)) {
        if (typeof row !== "object" || row === null) continue;
        const r = row as Record<string, unknown>;
        preview.push({
          label: typeof r.label === "string" ? r.label : "—",
          type: typeof r.type === "string" ? r.type : "—",
          trustLevel:
            typeof r.trustLevel === "string" ? r.trustLevel : "—",
        });
      }
      setAgendaSourcesPreview(preview.length > 0 ? preview : null);
      const rawSugg = Array.isArray(data.suggestions) ? data.suggestions : [];
      const parsed = rawSugg.filter(isValidTrabzonAgendaSuggestion);
      setAgendaSuggestions(parsed);
      setAgendaGeminiWarning(
        typeof data.error === "string" && data.error.trim()
          ? data.error.trim()
          : null
      );
    } catch {
      setAgendaCheckError("Ağ hatası.");
    } finally {
      setAgendaCheckLoading(false);
    }
  }, []);

  const checkXSignals = useCallback(async () => {
    setXSignalsCheckError(null);
    setXSignalsMessage(null);
    setXSignalsPrinciples(null);
    setXSignalsSignalPlan(null);
    setXSignalsEmpty(null);
    setXSignalsCheckLoading(true);
    try {
      const res = await fetch("/api/admin/seo-command-center/x-signals", {
        method: "GET",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        principles?: unknown;
        signalPlan?: unknown;
        signals?: unknown;
        error?: string;
      };
      if (res.status === 401) {
        setXSignalsCheckError(
          typeof data.error === "string"
            ? data.error
            : "Oturum gerekli veya yetkisiz."
        );
        return;
      }
      if (!res.ok) {
        setXSignalsCheckError(
          typeof data.error === "string"
            ? data.error
            : "İstek tamamlanamadı."
        );
        return;
      }
      if (data.ok !== true) {
        setXSignalsCheckError(
          typeof data.error === "string" ? data.error : "Yanıt reddedildi."
        );
        return;
      }
      setXSignalsMessage(typeof data.message === "string" ? data.message : null);
      const principles = Array.isArray(data.principles)
        ? data.principles.filter((x): x is string => typeof x === "string")
        : [];
      setXSignalsPrinciples(principles);
      const rawPlan = Array.isArray(data.signalPlan) ? data.signalPlan : [];
      const plan: Array<{ type: string; label: string; status: string }> = [];
      for (const row of rawPlan) {
        if (typeof row !== "object" || row === null) continue;
        const r = row as Record<string, unknown>;
        plan.push({
          type: typeof r.type === "string" ? r.type : "—",
          label: typeof r.label === "string" ? r.label : "—",
          status: typeof r.status === "string" ? r.status : "—",
        });
      }
      setXSignalsSignalPlan(plan);
      const sig = data.signals;
      setXSignalsEmpty(!Array.isArray(sig) || sig.length === 0);
    } catch {
      setXSignalsCheckError("Ağ hatası.");
    } finally {
      setXSignalsCheckLoading(false);
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

        <section
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-6"
          aria-label="Google index iletişimi"
        >
          <h2 className="admin-section-title text-base">
            Google index iletişimi
          </h2>
          <ul className="admin-helper m-0 mt-3 list-none space-y-2.5 p-0 text-sm leading-relaxed text-slate-400">
            <li className="flex gap-2">
              <span className="text-slate-600" aria-hidden>
                ·
              </span>
              <span>
                Sitemap aktif:{" "}
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
              <span>
                Yeni yayınlanan entry sonrası Google’a sitemap bildirimi
                gönderiliyor.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-slate-600" aria-hidden>
                ·
              </span>
              <span>Pending içerikler Google’a bildirilmez.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-slate-600" aria-hidden>
                ·
              </span>
              <span>
                Bu sistem index garantisi vermez; Google’a güncel sitemap’i haber
                verir.
              </span>
            </li>
          </ul>
        </section>

        <section
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-6"
          aria-label="Trabzon gündem motoru"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="admin-section-title text-base">
                Trabzon gündem motoru
              </h2>
              <p className="admin-helper mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                Trabzon gündemi, kaynaklı ve kontrollü önerilere dönüştürülecek.
                Sistem otomatik entry yayınlamaz.
              </p>
              <p className="admin-helper mt-1 text-xs text-slate-500">
                Otomatik entry yayını yoktur; öneriler yalnızca editör incelemesi
                içindir.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-slate-700/90 bg-slate-950/50 px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">
              FAZ 6D: kontrollü öneriler
            </span>
          </div>
          <button
            type="button"
            disabled={agendaCheckLoading}
            onClick={() => void checkTrabzonAgenda()}
            className="mt-4 rounded-lg border border-slate-600 bg-slate-950/60 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {agendaCheckLoading
              ? "Kontrol ediliyor..."
              : "Gündem motorunu kontrol et"}
          </button>
          {agendaCheckError ? (
            <p
              className="admin-msg-error mt-3 text-sm text-[var(--accent)]"
              role="alert"
            >
              {agendaCheckError}
            </p>
          ) : null}
          {agendaMessage ? (
            <p className="admin-helper mt-3 text-sm text-slate-300">
              {agendaMessage}
            </p>
          ) : null}
          {agendaGeminiWarning ? (
            <p
              className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95"
              role="status"
            >
              {agendaGeminiWarning}
            </p>
          ) : null}
          {agendaPrinciples && agendaPrinciples.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-slate-500">İlkeler</p>
              <ul className="admin-helper m-0 mt-1 list-none space-y-1.5 p-0 text-sm text-slate-400">
                {agendaPrinciples.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-slate-600" aria-hidden>
                      ·
                    </span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {agendaSourcePlan && agendaSourcePlan.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-slate-500">Kaynak planı</p>
              <ul className="admin-helper m-0 mt-1 list-none space-y-2 p-0 text-sm text-slate-400">
                {agendaSourcePlan.map((item, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-slate-800/80 bg-slate-950/30 px-3 py-2"
                  >
                    <span className="font-medium text-slate-300">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {item.type} · {item.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {agendaSourcesPreview && agendaSourcesPreview.length > 0 ? (
            <div className="mt-4 border-t border-slate-800/80 pt-4">
              <p className="text-xs font-medium text-slate-500">
                Kullanılan kaynaklar
              </p>
              <ul className="admin-helper m-0 mt-2 list-none space-y-2 p-0 text-sm text-slate-400">
                {agendaSourcesPreview.map((s, i) => (
                  <li
                    key={`${s.label}-${i}`}
                    className="rounded-lg border border-slate-800/80 bg-slate-950/30 px-3 py-2"
                  >
                    <span className="font-medium text-slate-300">
                      {s.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {s.type} · {s.trustLevel}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="admin-helper m-0 mt-2 text-xs leading-relaxed text-slate-500">
                Tüm öneriler bu ve benzeri güvenilir kaynaklara dayanacaktır.
              </p>
            </div>
          ) : null}
          {agendaSuggestions && agendaSuggestions.length > 0 ? (
            <div className="mt-4 border-t border-slate-800/80 pt-4">
              <p className="text-xs font-medium text-slate-500">
                Gündem önerileri
              </p>
              <ul className="m-0 mt-2 list-none space-y-3 p-0">
                {agendaSuggestions.map((s, i) => (
                  <li
                    key={`${s.suggestedEntryTitle}-${i}`}
                    className="rounded-lg border border-slate-800/90 bg-slate-950/40 px-3 py-3 text-sm"
                  >
                    <p className="m-0 text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">
                      Önerilen entry başlığı
                    </p>
                    <p className="m-0 mt-0.5 font-medium text-slate-100">
                      {s.suggestedEntryTitle}
                    </p>
                    <p className="m-0 mt-3 text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">
                      Açıklama
                    </p>
                    <p className="admin-helper m-0 mt-0.5 text-xs leading-relaxed text-slate-300">
                      {s.suggestedEntryDescription}
                    </p>
                    <p className="m-0 mt-3 text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">
                      Neden önerildi?
                    </p>
                    <p className="admin-helper m-0 mt-0.5 text-xs leading-relaxed text-slate-400">
                      {s.reason}
                    </p>
                    <p className="m-0 mt-1 text-[0.65rem] text-slate-600">
                      Tema: {s.title}
                    </p>
                    <p className="m-0 mt-2 text-[0.7rem] text-slate-500">
                      Güven seviyesi: {s.confidence} · Kategori: {s.category}{" "}
                      · Site tekrar riski: {s.siteDuplicateRisk}
                    </p>
                    <p className="m-0 mt-2 text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">
                      Kaynak notu
                    </p>
                    <p className="admin-helper m-0 mt-0.5 text-xs text-slate-500">
                      {s.sourceNote}
                    </p>
                    <p className="m-0 mt-2 text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">
                      Kaynak id&apos;leri
                    </p>
                    <p className="m-0 mt-0.5 break-all font-mono text-[0.65rem] text-slate-600">
                      {s.sourceIds.length ? s.sourceIds.join(", ") : "—"}
                    </p>
                    <p className="admin-helper m-0 mt-3 rounded-md border border-slate-700/60 bg-slate-900/50 px-2 py-1.5 text-[0.7rem] text-slate-400">
                      Bu öneri otomatik yayınlanmaz; admin kaynak kontrolünden
                      sonra entry&apos;ye dönüştürür.
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {agendaSuggestions !== null && agendaSuggestions.length === 0 ? (
            <p className="admin-helper mt-3 text-xs text-slate-500">
              Henüz otomatik gündem önerisi üretilmiyor.
            </p>
          ) : null}
        </section>

        <section
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-6"
          aria-label="X sinyal motoru"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="admin-section-title text-base">X sinyal motoru</h2>
              <p className="admin-helper mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                X gündemi doğrudan entry&apos;ye çevrilmez; önce Trabzon bağlamı
                ve güvenilir kaynaklarla doğrulanır.
              </p>
              <p className="admin-helper mt-2 rounded-md border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs leading-relaxed text-amber-100/95">
                X sinyalleri kaynak değildir; yalnızca gündem işareti olarak
                kullanılır.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-slate-700/90 bg-slate-950/50 px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">
              FAZ 7B: sinyal iskeleti hazır
            </span>
          </div>
          <button
            type="button"
            disabled={xSignalsCheckLoading}
            onClick={() => void checkXSignals()}
            className="mt-4 rounded-lg border border-slate-600 bg-slate-950/60 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {xSignalsCheckLoading
              ? "Kontrol ediliyor..."
              : "X sinyal motorunu kontrol et"}
          </button>
          {xSignalsCheckError ? (
            <p
              className="admin-msg-error mt-3 text-sm text-[var(--accent)]"
              role="alert"
            >
              {xSignalsCheckError}
            </p>
          ) : null}
          {xSignalsMessage ? (
            <p className="admin-helper mt-3 text-sm text-slate-300">
              {xSignalsMessage}
            </p>
          ) : null}
          {xSignalsPrinciples && xSignalsPrinciples.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-slate-500">İlkeler</p>
              <ul className="admin-helper m-0 mt-1 list-none space-y-1.5 p-0 text-sm text-slate-400">
                {xSignalsPrinciples.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-slate-600" aria-hidden>
                      ·
                    </span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {xSignalsSignalPlan && xSignalsSignalPlan.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-slate-500">Sinyal planı</p>
              <ul className="admin-helper m-0 mt-1 list-none space-y-2 p-0 text-sm text-slate-400">
                {xSignalsSignalPlan.map((item, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-slate-800/80 bg-slate-950/30 px-3 py-2"
                  >
                    <span className="font-medium text-slate-300">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {item.type} · {item.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {xSignalsEmpty === true ? (
            <p className="admin-helper mt-3 text-xs text-slate-500">
              Henüz otomatik X sinyali üretilmiyor.
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
          aria-label="SEO önerileri"
        >
          <h2 className="admin-section-title text-base">SEO Önerileri</h2>
          {aiPrepMode === "live" ? (
            <p className="admin-helper mt-2 text-xs font-medium text-sky-300/90">
              Gemini tarafından analiz edildi
            </p>
          ) : null}
          <p className="admin-helper mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Teknik SEO taraması, Search Console örnekleri (OAuth ile bağlıysanız)
            ve Gemini ile kısa, kaynak odaklı öneriler üretilir.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={aiPrepLoading}
              onClick={() => void prepareAiOpportunities()}
              className="rounded-lg border border-sky-600/45 bg-sky-600/85 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {aiPrepLoading ? "Üretiliyor..." : "SEO ÖNERİLERİNİ ÜRET"}
            </button>
          </div>
          {gscTrustLines && gscTrustLines.length > 0 ? (
            <div
              className="mt-4 rounded-lg border border-slate-700/80 bg-slate-950/45 px-3 py-2.5 text-sm text-slate-300"
              role="status"
            >
              {gscTrustLines.map((line, i) => (
                <p key={`gsc-trust-${i}`} className="m-0 break-words leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          ) : null}
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
          {aiOpportunities.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-3">
              {aiOpportunities.map((opp, idx) => {
                const needsSourceVerify =
                  opp.sources.filter((s) => s.trim().length > 0).length === 0;
                return (
                  <article
                    key={`seo-rec-${idx}-${opp.title.slice(0, 24)}`}
                    className="rounded-xl border border-slate-700/90 bg-slate-950/40 p-4 shadow-none"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-100">
                        {opp.title}
                      </h3>
                      <span className="shrink-0 rounded-full border border-slate-600/90 bg-slate-900/60 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-300">
                        Öncelik: {priorityLabel(opp.priority)}
                      </span>
                    </div>
                    <p className="admin-helper mt-2 text-xs font-medium text-slate-500">
                      Kaynak tipi: {sourceTypeLabel(opp.sourceType)}
                    </p>
                    <p className="admin-helper mt-2 break-words text-sm leading-relaxed text-slate-400">
                      <span className="font-medium text-slate-300">
                        Neden:{" "}
                      </span>
                      {opp.reason}
                    </p>
                    {opp.suggestedEntryTitle.trim() ? (
                      <p className="admin-helper mt-2 break-words text-sm text-slate-300">
                        <span className="font-medium text-slate-400">
                          Önerilen entry başlığı:{" "}
                        </span>
                        {opp.suggestedEntryTitle}
                      </p>
                    ) : (
                      <p className="admin-helper mt-2 text-xs text-slate-600">
                        Önerilen entry başlığı: (boş)
                      </p>
                    )}
                    <p className="admin-helper mt-2 text-xs text-slate-500">
                      Güven: {confidenceLabel(opp.confidence)}
                    </p>
                    {needsSourceVerify ? (
                      <p
                        className="admin-helper mt-3 rounded border border-amber-500/35 bg-amber-500/10 px-2 py-1.5 text-xs font-medium text-amber-100/95"
                        role="alert"
                      >
                        Kaynak doğrulaması gerekli
                      </p>
                    ) : null}
                    <div className="mt-3 border-t border-slate-800/80 pt-2">
                      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">
                        Kaynaklar
                      </p>
                      {opp.sources.filter((s) => s.trim().length > 0).length >
                      0 ? (
                        <ul className="m-0 mt-1 list-none space-y-1 p-0">
                          {opp.sources
                            .filter((s) => s.trim().length > 0)
                            .map((src, srcIdx) => (
                              <li
                                key={`${idx}-src-${srcIdx}`}
                                className="break-words text-[0.7rem] leading-snug text-slate-400"
                              >
                                {looksLikeUrl(src) ? (
                                  <a
                                    href={src.trim()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="break-all text-sky-400/95 underline-offset-2 hover:underline"
                                  >
                                    {src.trim()}
                                  </a>
                                ) : (
                                  <span className="break-words">{src}</span>
                                )}
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="admin-helper m-0 mt-1 text-xs text-slate-600">
                          Listelenmiş kaynak yok.
                        </p>
                      )}
                    </div>
                    {opp.sourceNote.trim() ? (
                      <p className="admin-helper mt-2 break-words text-xs leading-relaxed text-slate-500">
                        <span className="font-medium text-slate-400">
                          Kaynak notu:{" "}
                        </span>
                        {opp.sourceNote}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}
          {!aiPrepLoading && aiOpportunities.length === 0 && !aiPrepError ? (
            <p className="admin-helper mt-4 rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2.5 text-sm text-slate-500">
              Henüz SEO önerisi üretilmedi. Yukarıdaki düğmeyi kullanın.
            </p>
          ) : null}
          {aiSources ? (
            <details className="mt-4 rounded-lg border border-slate-800 bg-slate-950/35">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-300 marker:text-slate-500 hover:bg-slate-900/40">
                Teknik analiz kaynaklarını göster
              </summary>
              <div
                className="border-t border-slate-800 p-4"
                aria-label="Analiz kaynakları"
              >
                <dl className="admin-helper mt-0 space-y-2 text-xs leading-relaxed text-slate-400">
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-medium text-slate-500">Gemini modeli</dt>
                    <dd className="break-all font-mono text-slate-300">
                      {aiSources.model}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-medium text-slate-500">Çıktı formatı</dt>
                    <dd className="break-all font-mono text-slate-300">
                      {aiSources.responseMimeType}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-medium text-slate-500">GSC OAuth</dt>
                    <dd className="break-words text-slate-300">
                      {aiSources.gscConnected
                        ? aiSources.gscDataAvailable
                          ? "Bağlı · örnek sorgular prompt’a eklendi"
                          : "Bağlı · örnek sorgu yok veya API yanıt vermedi"
                        : "Bağlı değil"}
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
                    <div className="break-words text-slate-500">
                      Kayıtlı tarama zamanı bulunamadı (henüz tarama yok veya
                      geçmiş okunamadı).
                    </div>
                  )}
                </dl>
                {aiSources.gscQueriesSample.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-slate-500">
                      Prompt’a dahil GSC sorgu örnekleri
                    </p>
                    <ul className="m-0 mt-1 list-none space-y-1 p-0">
                      {aiSources.gscQueriesSample.map((q, qi) => (
                        <li
                          key={`gsc-q-${qi}`}
                          className="break-words rounded border border-slate-800/80 bg-slate-900/30 px-2 py-1 text-[0.7rem] text-slate-400"
                        >
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
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
                          <span className="break-words text-slate-300">
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
                            <span className="mt-0.5 block space-y-0.5 break-words text-slate-400">
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
            </details>
          ) : null}
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
                {m.title === GSC_MODULE_TITLE ? (
                  <>
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
                          Sunucu ortamında GSC ile ilgili ek yapılandırma tanımlı
                          görünüyor.
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
                  </>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
