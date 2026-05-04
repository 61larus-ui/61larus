import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

export const runtime = "nodejs";

const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_TIMEOUT_MS = 60_000;

const MAX_OPPORTUNITY_SOURCES = 5;

/** Gemini REST Schema: JSON çıktısı için dizi şeması */
const OPPORTUNITIES_JSON_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      type: { type: "STRING" },
      priority: { type: "STRING" },
      title: { type: "STRING" },
      reason: { type: "STRING" },
      action: { type: "STRING" },
      sources: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            url: { type: "STRING" },
          },
          required: ["name"],
        },
      },
    },
    required: ["type", "priority", "title", "reason", "sources"],
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

type OpportunityCitation = {
  name: string;
  url?: string;
};

type OpportunityOut = {
  type: string;
  priority: string;
  title: string;
  reason: string;
  sources: OpportunityCitation[];
  action?: string;
  status?: string;
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
};

function buildSourcesPayload(
  model: string,
  ctx: {
    summary: RawAuditPayload["summary"] | null;
    issuesSlice: NonNullable<RawAuditPayload["issues"]>;
    entrySeoSlice: NonNullable<RawAuditPayload["entrySeo"]>;
    auditCheckedAt: string | null;
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
  };
}

const FALLBACK_AUDIT_SOURCE: OpportunityCitation = {
  name: "61Sözlük son SEO taraması",
  url: "https://61sozluk.com/admin/seo-command-center",
};

const FALLBACK_OPPORTUNITIES: OpportunityOut[] = [
  {
    type: "new_entry",
    priority: "high",
    title: "Yeni başlık fırsatları",
    reason:
      "Gündem ve Search Console verileri bağlandığında burada öneriler üretilecek.",
    status: "hazırlanıyor",
    sources: [FALLBACK_AUDIT_SOURCE],
  },
  {
    type: "improve_existing",
    priority: "medium",
    title: "Mevcut entry güçlendirme",
    reason:
      "Meta description, iç link ve başlık iyileştirme önerileri burada listelenecek.",
    status: "hazırlanıyor",
    sources: [FALLBACK_AUDIT_SOURCE],
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

function normalizeCitationSources(
  raw: unknown
): OpportunityCitation[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: OpportunityCitation[] = [];
  for (const item of raw) {
    if (out.length >= MAX_OPPORTUNITY_SOURCES) break;
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.name !== "string" || !r.name.trim()) continue;
    const name = r.name.trim();
    if (typeof r.url === "string" && r.url.trim()) {
      out.push({ name, url: r.url.trim() });
    } else {
      out.push({ name });
    }
  }
  return out.length > 0 ? out : null;
}

function normalizeOpportunity(raw: unknown): OpportunityOut | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = o.title;
  const reason = o.reason;
  if (typeof title !== "string" || typeof reason !== "string") return null;
  const citations = normalizeCitationSources(o.sources);
  if (!citations) return null;
  const typeRaw = typeof o.type === "string" ? takeFirstEnumPart(o.type) : "seo_issue";
  const priorityRaw =
    typeof o.priority === "string" ? takeFirstEnumPart(o.priority) : "medium";
  const action = typeof o.action === "string" ? o.action : undefined;
  return {
    type: typeRaw || "seo_issue",
    priority: priorityRaw || "medium",
    title: title.trim(),
    reason: reason.trim(),
    sources: citations,
    ...(action ? { action: action.trim() } : {}),
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
}): string {
  const summaryJson = JSON.stringify(input.summary ?? {}, null, 2);
  const issuesJson = JSON.stringify(input.issuesSlice, null, 2);
  const entrySeoJson = JSON.stringify(input.entrySeoSlice, null, 2);

  return `Sen bir SEO ve içerik stratejisti olarak 61Sözlük için analiz yap.

Bu platform:
- Trabzon odaklı
- bilgi temelli
- akademik ve kaliteli içerik ister
- spam içerik istemez

Veriler:

Son SEO taraması özeti (summary):
${summaryJson}

issues (ilk kayıtlar):
${issuesJson}

entrySeo (ilk kayıtlar, canlı sayfa title/description örnekleri):
${entrySeoJson}

Aşağıdaki verilere göre:
1. Yeni başlık fırsatları üret
2. Mevcut entry'ler için iyileştirme öner
3. SEO zayıf noktaları belirt

Zorunlu kural — kaynak:
Trabzon ile ilgili her bilgi potansiyel entry olabilir. Ancak her öneri bilimsel, akademik veya açık kaynakla desteklenmek zorundadır. Kaynağı olmayan öneri üretme. Her öneride sources alanı bulunmalı ve kaynak adı + mümkünse URL verilmelidir.

Çıktın API tarafından zorunlu olarak application/json (dizi) formatında istenecek.
Yalnızca bu alanları kullan:

[
  {
    "type": "new_entry",
    "priority": "high",
    "title": "...",
    "reason": "...",
    "action": "...",
    "sources": [
      { "name": "Kaynak adı", "url": "https://..." }
    ]
  }
]

Her öğede "sources" en az bir kaynak içermeli; en fazla ${MAX_OPPORTUNITY_SOURCES} kaynak.
Her kaynakta "name" zorunlu; "url" mümkünse dolu olsun.

type alanı şunlardan biri olmalı: new_entry, improve_existing, seo_issue
priority: high, medium veya low
action isteğe bağlıdır; mümkünse doldur.`;
}

export async function POST() {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({
      ok: false,
      error: "Gemini API key tanımlı değil.",
      opportunities: [],
    });
  }

  const ctx = await loadLatestAuditContext();
  const modelId = resolveGeminiModel();
  const sources = buildSourcesPayload(modelId, ctx);

  const prompt = buildPrompt({
    summary: ctx.summary,
    issuesSlice: ctx.issuesSlice,
    entrySeoSlice: ctx.entrySeoSlice,
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
      });
    }

    const text = extractGeminiText(rawBody);
    if (!text) {
      return NextResponse.json({
        ok: true,
        mode: "live",
        opportunities: FALLBACK_OPPORTUNITIES,
        sources,
      });
    }

    const arr = parseOpportunitiesFromModelText(text);
    if (!arr) {
      return NextResponse.json({
        ok: true,
        mode: "live",
        opportunities: FALLBACK_OPPORTUNITIES,
        sources,
      });
    }

    const normalized: OpportunityOut[] = [];
    for (const item of arr) {
      const n = normalizeOpportunity(item);
      if (n) normalized.push(n);
    }

    if (normalized.length === 0 && arr.length > 0) {
      return NextResponse.json({
        ok: true,
        mode: "live",
        opportunities: FALLBACK_OPPORTUNITIES,
        sources,
      });
    }

    return NextResponse.json({
      ok: true,
      mode: "live",
      opportunities: normalized,
      sources,
    });
  } catch (e) {
    console.error("[ai-opportunities] Gemini request failed:", e);
    return NextResponse.json({
      ok: false,
      error: "Gemini analiz hatası",
      opportunities: [],
      sources,
    });
  } finally {
    clearTimeout(timer);
  }
}
