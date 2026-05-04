import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

export const runtime = "nodejs";

const GEMINI_MODEL = "gemini-pro";
const GEMINI_TIMEOUT_MS = 60_000;

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

type OpportunityOut = {
  type: string;
  priority: string;
  title: string;
  reason: string;
  action?: string;
  status?: string;
};

const FALLBACK_OPPORTUNITIES: OpportunityOut[] = [
  {
    type: "new_entry",
    priority: "high",
    title: "Yeni başlık fırsatları",
    reason:
      "Gündem ve Search Console verileri bağlandığında burada öneriler üretilecek.",
    status: "hazırlanıyor",
  },
  {
    type: "improve_existing",
    priority: "medium",
    title: "Mevcut entry güçlendirme",
    reason:
      "Meta description, iç link ve başlık iyileştirme önerileri burada listelenecek.",
    status: "hazırlanıyor",
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

function normalizeOpportunity(raw: unknown): OpportunityOut | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = o.title;
  const reason = o.reason;
  if (typeof title !== "string" || typeof reason !== "string") return null;
  const typeRaw = typeof o.type === "string" ? takeFirstEnumPart(o.type) : "seo_issue";
  const priorityRaw =
    typeof o.priority === "string" ? takeFirstEnumPart(o.priority) : "medium";
  const action = typeof o.action === "string" ? o.action : undefined;
  return {
    type: typeRaw || "seo_issue",
    priority: priorityRaw || "medium",
    title: title.trim(),
    reason: reason.trim(),
    ...(action ? { action: action.trim() } : {}),
  };
}

async function loadLatestAuditContext(): Promise<{
  summary: RawAuditPayload["summary"] | null;
  issuesSlice: NonNullable<RawAuditPayload["issues"]>;
  entrySeoSlice: NonNullable<RawAuditPayload["entrySeo"]>;
}> {
  const service = createSupabaseServiceClient();
  if (!service) {
    return { summary: null, issuesSlice: [], entrySeoSlice: [] };
  }
  const { data, error } = await service
    .from("seo_audit_runs")
    .select("raw_result")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.raw_result || typeof data.raw_result !== "object") {
    return { summary: null, issuesSlice: [], entrySeoSlice: [] };
  }
  const raw = data.raw_result as RawAuditPayload;
  const issues = Array.isArray(raw.issues) ? raw.issues.slice(0, 10) : [];
  const entrySeo = Array.isArray(raw.entrySeo) ? raw.entrySeo.slice(0, 5) : [];
  return {
    summary: raw.summary ?? null,
    issuesSlice: issues,
    entrySeoSlice: entrySeo,
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

Yanıtın YALNIZCA aşağıdaki yapıda bir JSON dizisi olsun; başka metin, markdown veya açıklama ekleme:

[
  {
    "type": "new_entry",
    "priority": "high",
    "title": "...",
    "reason": "...",
    "action": "..."
  }
]

type alanı şunlardan biri olmalı: new_entry, improve_existing, seo_issue
priority: high, medium veya low`;
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
  const prompt = buildPrompt({
    summary: ctx.summary,
    issuesSlice: ctx.issuesSlice,
    entrySeoSlice: ctx.entrySeoSlice,
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GEMINI_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
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
      });
    }

    const text = extractGeminiText(rawBody);
    if (!text) {
      return NextResponse.json({
        ok: true,
        mode: "live",
        opportunities: FALLBACK_OPPORTUNITIES,
      });
    }

    const arr = parseOpportunitiesFromModelText(text);
    if (!arr) {
      return NextResponse.json({
        ok: true,
        mode: "live",
        opportunities: FALLBACK_OPPORTUNITIES,
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
      });
    }

    return NextResponse.json({
      ok: true,
      mode: "live",
      opportunities: normalized,
    });
  } catch (e) {
    console.error("[ai-opportunities] Gemini request failed:", e);
    return NextResponse.json({
      ok: false,
      error: "Gemini analiz hatası",
      opportunities: [],
    });
  } finally {
    clearTimeout(timer);
  }
}
