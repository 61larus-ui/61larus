import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

export const runtime = "nodejs";

const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_TIMEOUT_MS = 60_000;

const MAX_OPPORTUNITY_SOURCES = 5;
const GSC_SITE_URL = "sc-domain:61sozluk.com";

const MISSING_SOURCE_NOTE =
  "Bu öneri yayınlanmadan önce açık/akademik kaynakla doğrulanmalıdır.";

type PriorityLevel = "low" | "medium" | "high";
type ConfidenceLevel = "low" | "medium" | "high";
type SourceType =
  | "gsc"
  | "technical_audit"
  | "content_gap"
  | "academic_source_required";

/** Gemini REST Schema: JSON dizi çıktısı */
const OPPORTUNITIES_JSON_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      title: { type: "STRING" },
      reason: { type: "STRING" },
      suggestedEntryTitle: { type: "STRING" },
      priority: { type: "STRING" },
      sourceType: { type: "STRING" },
      sources: {
        type: "ARRAY",
        items: { type: "STRING" },
      },
      sourceNote: { type: "STRING" },
      confidence: { type: "STRING" },
    },
    required: [
      "title",
      "reason",
      "suggestedEntryTitle",
      "priority",
      "sourceType",
      "sources",
      "sourceNote",
      "confidence",
    ],
  },
} as const;

function resolveGeminiModel(): string {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_GEMINI_MODEL;
}

type RawAuditPayload = {
  summary?: {
    score?: number;
    checkedUrls?: number;
    criticalIssues?: number;
    warnings?: number;
  };
  issues?: Array<{
    severity?: string;
    title?: string;
    detail?: string;
    url?: string;
  }>;
  entrySeo?: Array<{
    url?: string;
    title?: string | null;
    description?: string | null;
  }>;
};

type SeoRecommendationOut = {
  title: string;
  reason: string;
  suggestedEntryTitle: string;
  priority: PriorityLevel;
  sourceType: SourceType;
  sources: string[];
  sourceNote: string;
  confidence: ConfidenceLevel;
};

type AiOpportunitySourcesPayload = {
  model: string;
  responseMimeType: "application/json";
  auditCheckedAt: string | null;
  summary: RawAuditPayload["summary"] | null;
  issuesUsedCount: number;
  issuesUsed: NonNullable<RawAuditPayload["issues"]>;
  entrySeoUsedCount: number;
  entrySeoUsed: NonNullable<RawAuditPayload["entrySeo"]>;
  gscConnected: boolean;
  gscDataAvailable: boolean;
  gscQueriesSample: string[];
};

function buildSourcesPayload(
  model: string,
  ctx: {
    summary: RawAuditPayload["summary"] | null;
    issuesSlice: NonNullable<RawAuditPayload["issues"]>;
    entrySeoSlice: NonNullable<RawAuditPayload["entrySeo"]>;
    auditCheckedAt: string | null;
    gscConnected: boolean;
    gscDataAvailable: boolean;
    gscQueriesSample: string[];
  }
): AiOpportunitySourcesPayload {
  return {
    model,
    responseMimeType: "application/json",
    auditCheckedAt: ctx.auditCheckedAt,
    summary: ctx.summary,
    issuesUsedCount: ctx.issuesSlice.length,
    issuesUsed: ctx.issuesSlice,
    entrySeoUsedCount: ctx.entrySeoSlice.length,
    entrySeoUsed: ctx.entrySeoSlice,
    gscConnected: ctx.gscConnected,
    gscDataAvailable: ctx.gscDataAvailable,
    gscQueriesSample: ctx.gscQueriesSample,
  };
}

function buildGscTrustLines(
  connected: boolean,
  dataAvailable: boolean
): string[] {
  if (!connected) {
    return ["Google Search Console OAuth ile bağlı değilsiniz."];
  }
  if (!dataAvailable) {
    return [
      "Google Search Console bağlantısı aktif.",
      "Bağlantı aktif, performans verisi oluşması bekleniyor.",
    ];
  }
  return [
    "Google Search Console bağlantısı aktif.",
    "GSC verisi öneri üretiminde kullanılabilir.",
  ];
}

async function fetchGscQuerySample(accessToken: string): Promise<{
  ok: boolean;
  rows: Array<{ keys?: string[] }>;
}> {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 28);
  const formatDate = (d: Date) => d.toISOString().split("T")[0];
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  try {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
        GSC_SITE_URL
      )}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          dimensions: ["query"],
          rowLimit: 15,
          startRow: 0,
        }),
      }
    );
    const data = (await res.json()) as { rows?: unknown };
    const rows = Array.isArray(data.rows) ? (data.rows as Array<{ keys?: string[] }>) : [];
    return { ok: res.ok, rows };
  } catch {
    return { ok: false, rows: [] };
  }
}

function extractQueriesFromRows(rows: Array<{ keys?: string[] }>): string[] {
  const out: string[] = [];
  for (const row of rows) {
    if (out.length >= MAX_OPPORTUNITY_SOURCES) break;
    const k = row.keys?.[0];
    if (typeof k === "string" && k.trim()) out.push(k.trim());
  }
  return out;
}

const FALLBACK_RECOMMENDATIONS: SeoRecommendationOut[] = [
  {
    title: "Veri bağlandığında öneriler üretilecek",
    reason:
      "Son teknik SEO taraması ve mümkünse Search Console sorgu örnekleri Gemini’ye iletilerek öneri üretilir.",
    suggestedEntryTitle: "",
    priority: "medium",
    sourceType: "content_gap",
    sources: [],
    sourceNote: MISSING_SOURCE_NOTE,
    confidence: "low",
  },
];

function takeFirstEnumPart(value: string): string {
  const pipe = value.indexOf("|");
  return pipe >= 0 ? value.slice(0, pipe).trim() : value.trim();
}

function extractGeminiText(data: unknown): string | null {
  const root = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text = root?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" ? text : null;
}

function parseOpportunitiesFromModelText(text: string): unknown[] | null {
  const trimmed = text.trim();
  try {
    const direct: unknown = JSON.parse(trimmed);
    if (Array.isArray(direct)) return direct;
  } catch {
    /* continue */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const blob = fence ? fence[1].trim() : trimmed;
  try {
    const parsed: unknown = JSON.parse(blob);
    if (Array.isArray(parsed)) return parsed;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { opportunities?: unknown }).opportunities)
    ) {
      return (parsed as { opportunities: unknown[] }).opportunities;
    }
  } catch {
    const start = blob.indexOf("[");
    const end = blob.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        const parsed: unknown = JSON.parse(blob.slice(start, end + 1));
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return null;
      }
    }
    return null;
  }
  return null;
}

const PRIORITIES = new Set<PriorityLevel>(["low", "medium", "high"]);
const CONFIDENCES = new Set<ConfidenceLevel>(["low", "medium", "high"]);
const SOURCE_TYPES = new Set<SourceType>([
  "gsc",
  "technical_audit",
  "content_gap",
  "academic_source_required",
]);

function normalizePriority(v: unknown): PriorityLevel {
  const s =
    typeof v === "string"
      ? takeFirstEnumPart(v).toLowerCase()
      : "";
  if (PRIORITIES.has(s as PriorityLevel)) return s as PriorityLevel;
  return "medium";
}

function normalizeConfidence(v: unknown): ConfidenceLevel {
  const s =
    typeof v === "string"
      ? takeFirstEnumPart(v).toLowerCase()
      : "";
  if (CONFIDENCES.has(s as ConfidenceLevel)) return s as ConfidenceLevel;
  return "medium";
}

function normalizeSourceType(v: unknown): SourceType {
  const s =
    typeof v === "string"
      ? takeFirstEnumPart(v).toLowerCase()
      : "";
  if (SOURCE_TYPES.has(s as SourceType)) return s as SourceType;
  return "content_gap";
}

/** Legacy: kaynak nesneleri veya string dizisi */
function normalizeSourcesArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (out.length >= MAX_OPPORTUNITY_SOURCES) break;
    if (typeof item === "string") {
      const t = item.trim();
      if (t) out.push(t);
      continue;
    }
    if (item && typeof item === "object") {
      const r = item as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name.trim() : "";
      const url = typeof r.url === "string" ? r.url.trim() : "";
      if (!name && !url) continue;
      if (name && url) out.push(`${name} — ${url}`);
      else out.push(name || url);
    }
  }
  return out;
}

function legacyTypeToSourceType(typeRaw: string): SourceType {
  const t = takeFirstEnumPart(typeRaw).toLowerCase();
  if (t === "new_entry") return "content_gap";
  if (t === "improve_existing" || t === "seo_issue") return "technical_audit";
  return "content_gap";
}

/** Yeni veya eski Gemini öğesinden SeoRecommendationOut üretir (henüz kaynak normalizasyonu yok). */
function parseRecommendationItem(raw: unknown): SeoRecommendationOut | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const title =
    typeof o.title === "string" ? o.title.trim() : "";
  const reason =
    typeof o.reason === "string" ? o.reason.trim() : "";
  if (!title || !reason) return null;

  let suggestedEntryTitle =
    typeof o.suggestedEntryTitle === "string"
      ? o.suggestedEntryTitle.trim()
      : "";

  let sourceType: SourceType;
  let sourcesRaw: unknown = o.sources;

  if (typeof o.sourceType === "string") {
    sourceType = normalizeSourceType(o.sourceType);
  } else if (typeof o.type === "string") {
    sourceType = legacyTypeToSourceType(o.type);
  } else {
    sourceType = "content_gap";
  }

  const priority = normalizePriority(o.priority);
  let confidence = normalizeConfidence(o.confidence);
  let sourceNote =
    typeof o.sourceNote === "string" ? o.sourceNote.trim() : "";

  const sources = normalizeSourcesArray(sourcesRaw);

  if (
    !suggestedEntryTitle &&
    typeof o.action === "string" &&
    o.action.trim()
  ) {
    suggestedEntryTitle = o.action.trim();
  }

  return {
    title,
    reason,
    suggestedEntryTitle,
    priority,
    sourceType,
    sources,
    sourceNote,
    confidence,
  };
}

function applyMissingSourceDefaults(rec: SeoRecommendationOut): SeoRecommendationOut {
  const hasSources = rec.sources.some((s) => s.trim().length > 0);
  if (hasSources) return rec;
  return {
    ...rec,
    sources: [],
    sourceNote:
      rec.sourceNote.trim().length > 0 ? rec.sourceNote : MISSING_SOURCE_NOTE,
    confidence: "low",
    sourceType:
      rec.sourceType === "academic_source_required"
        ? rec.sourceType
        : "academic_source_required",
  };
}

async function loadLatestAuditContext(): Promise<{
  summary: RawAuditPayload["summary"] | null;
  issuesSlice: NonNullable<RawAuditPayload["issues"]>;
  entrySeoSlice: NonNullable<RawAuditPayload["entrySeo"]>;
  auditCheckedAt: string | null;
}> {
  const service = createSupabaseServiceClient();
  if (!service) {
    return {
      summary: null,
      issuesSlice: [],
      entrySeoSlice: [],
      auditCheckedAt: null,
    };
  }
  const { data, error } = await service
    .from("seo_audit_runs")
    .select("raw_result")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.raw_result || typeof data.raw_result !== "object") {
    return {
      summary: null,
      issuesSlice: [],
      entrySeoSlice: [],
      auditCheckedAt: null,
    };
  }
  const raw = data.raw_result as RawAuditPayload & { checkedAt?: string };
  const issues = Array.isArray(raw.issues) ? raw.issues.slice(0, 10) : [];
  const entrySeo = Array.isArray(raw.entrySeo) ? raw.entrySeo.slice(0, 5) : [];
  const auditCheckedAt =
    typeof raw.checkedAt === "string" && raw.checkedAt.trim()
      ? raw.checkedAt.trim()
      : null;
  return {
    summary: raw.summary ?? null,
    issuesSlice: issues,
    entrySeoSlice: entrySeo,
    auditCheckedAt,
  };
}

function buildPrompt(input: {
  summary: RawAuditPayload["summary"] | null;
  issuesSlice: NonNullable<RawAuditPayload["issues"]>;
  entrySeoSlice: NonNullable<RawAuditPayload["entrySeo"]>;
  gscQueriesSample: string[];
}): string {
  const summaryJson = JSON.stringify(input.summary ?? {}, null, 2);
  const issuesJson = JSON.stringify(input.issuesSlice, null, 2);
  const entrySeoJson = JSON.stringify(input.entrySeoSlice, null, 2);
  const gscJson = JSON.stringify(input.gscQueriesSample, null, 2);

  return `Sen bir SEO ve içerik stratejisti olarak 61Sözlük için analiz yap.

Bu platform:
- Trabzon odaklı
- bilgi temelli
- akademik ve kaliteli içerik ister
- spam içerik istemez

Veriler:

Son SEO taraması özeti (summary):
${summaryJson}

Teknik audit sorunları (issues, ilk kayıtlar):
${issuesJson}

entrySeo (canlı sayfa title/description örnekleri):
${entrySeoJson}

Search Console arama sorgusu örnekleri (varsa; boş dizi ise GSC verisi prompt'a dahil değildir):
${gscJson}

Görev:
1) Teknik audit ve SEO örneklerine dayalı iyileştirme önerileri üret.
2) GSC sorgu örnekleri verilmişse bunlara dayalı içerik veya entry başlığı fırsatları öner; sourceType alanında "gsc" kullan ve sources dizisine kamuya açık kaynak URL veya kaynak adı yaz.
3) Her öneri için mantıklı bir suggestedEntryTitle öner (61Sözlük başlığı — kısa ve net).

Zorunlu kurallar — kaynak:
Trabzon ile ilgili her bilgi potansiyel entry olabilir. Önerileri mümkün olduğunca bilimsel, akademik veya güvenilir açık kaynaklarla destekle.
Kaynak veremiyorsan sources dizisini boş bırak ve sourceNote alanında kısa gerekçe yaz; confidence düşük olmalı.

Çıktın yalnızca application/json dizi formatında olmalı. Her öğede şu alanlar olmalı:
- title: özet başlık
- reason: neden önerildi
- suggestedEntryTitle: önerilen entry başlığı (boş string olabilir)
- priority: "low" | "medium" | "high"
- sourceType: "gsc" | "technical_audit" | "content_gap" | "academic_source_required"
- sources: string dizisi (en fazla ${MAX_OPPORTUNITY_SOURCES} öğe; URL veya "Yayıncı — başlık" biçimi)
- sourceNote: kaynaklar veya güven için kısa not
- confidence: "low" | "medium" | "high"

Örnek:
[
  {
    "title": "...",
    "reason": "...",
    "suggestedEntryTitle": "...",
    "priority": "high",
    "sourceType": "technical_audit",
    "sources": ["https://developers.google.com/search/docs/..."],
    "sourceNote": "...",
    "confidence": "medium"
  }
]`;
}

export async function POST() {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;

  const cookieStore = await cookies();
  const gscAccessToken = cookieStore.get("gsc_access_token")?.value;
  const gscConnected = Boolean(gscAccessToken?.trim());

  let gscQueriesSample: string[] = [];
  let gscFetchOk = false;
  if (gscAccessToken?.trim()) {
    const gscRes = await fetchGscQuerySample(gscAccessToken.trim());
    gscFetchOk = gscRes.ok;
    gscQueriesSample = extractQueriesFromRows(gscRes.rows);
  }

  const gscDataAvailable =
    gscConnected && gscFetchOk && gscQueriesSample.length > 0;

  const ctx = await loadLatestAuditContext();
  const modelId = resolveGeminiModel();
  const sources = buildSourcesPayload(modelId, {
    summary: ctx.summary,
    issuesSlice: ctx.issuesSlice,
    entrySeoSlice: ctx.entrySeoSlice,
    auditCheckedAt: ctx.auditCheckedAt,
    gscConnected,
    gscDataAvailable,
    gscQueriesSample,
  });

  const gscTrust = {
    connected: gscConnected,
    dataAvailable: gscDataAvailable,
    lines: buildGscTrustLines(gscConnected, gscDataAvailable),
  };

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({
      ok: false,
      error: "Gemini API key tanımlı değil.",
      opportunities: [],
      sources,
      gscTrust,
    });
  }

  const prompt = buildPrompt({
    summary: ctx.summary,
    issuesSlice: ctx.issuesSlice,
    entrySeoSlice: ctx.entrySeoSlice,
    gscQueriesSample,
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(key)}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GEMINI_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: OPPORTUNITIES_JSON_SCHEMA,
        },
      }),
    });

    const rawBody: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        rawBody &&
        typeof rawBody === "object" &&
        typeof (rawBody as { error?: { message?: string } }).error?.message ===
          "string"
          ? (rawBody as { error: { message: string } }).error.message
          : `HTTP ${res.status}`;
      console.error("[ai-opportunities] Gemini HTTP error:", msg);
      return NextResponse.json({
        ok: false,
        error: "Gemini analiz hatası",
        opportunities: [],
        sources,
        gscTrust,
      });
    }

    const text = extractGeminiText(rawBody);
    if (!text) {
      const normalizedFallback = FALLBACK_RECOMMENDATIONS.map(applyMissingSourceDefaults);
      return NextResponse.json({
        ok: true,
        mode: "live",
        opportunities: normalizedFallback,
        sources,
        gscTrust,
      });
    }

    const arr = parseOpportunitiesFromModelText(text);
    if (!arr) {
      const normalizedFallback = FALLBACK_RECOMMENDATIONS.map(applyMissingSourceDefaults);
      return NextResponse.json({
        ok: true,
        mode: "live",
        opportunities: normalizedFallback,
        sources,
        gscTrust,
      });
    }

    const normalized: SeoRecommendationOut[] = [];
    for (const item of arr) {
      const n = parseRecommendationItem(item);
      if (n) normalized.push(applyMissingSourceDefaults(n));
    }

    if (normalized.length === 0 && arr.length > 0) {
      const normalizedFallback = FALLBACK_RECOMMENDATIONS.map(applyMissingSourceDefaults);
      return NextResponse.json({
        ok: true,
        mode: "live",
        opportunities: normalizedFallback,
        sources,
        gscTrust,
      });
    }

    const finalList =
      normalized.length === 0
        ? FALLBACK_RECOMMENDATIONS.map(applyMissingSourceDefaults)
        : normalized;

    return NextResponse.json({
      ok: true,
      mode: "live",
      opportunities: finalList,
      sources,
      gscTrust,
    });
  } catch (e) {
    console.error("[ai-opportunities] Gemini request failed:", e);
    return NextResponse.json({
      ok: false,
      error: "Gemini analiz hatası",
      opportunities: [],
      sources,
      gscTrust,
    });
  } finally {
    clearTimeout(timer);
  }
}
