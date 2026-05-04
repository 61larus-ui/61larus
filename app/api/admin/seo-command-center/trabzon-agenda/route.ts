import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";

export const runtime = "nodejs";

const OPENAI_TIMEOUT_MS = 60_000;
const TARGET_COUNT = 8;

const FALLBACK_DESCRIPTION =
  "Konu özeti oluşturulamadı; makaleleri ve başlığı kontrol ederek editör yazımı gerekebilir.";
const SOURCE_VERIFY_PHRASE = "Kaynak doğrulaması gerekli.";

const CATEGORY_SET = new Set([
  "tarih",
  "kultur",
  "sehir",
  "akademik",
  "siyaset",
  "ekonomi",
  "toplum",
]);

const CONFIDENCE_SET = new Set(["low", "medium", "high"]);
const DUPLICATE_RISK_SET = new Set(["low", "medium", "high"]);

export type AcademicEntrySuggestionOut = {
  suggestedEntryTitle: string;
  suggestedEntryDescription: string;
  reason: string;
  sources: string[];
  sourceNote: string;
  confidence: "low" | "medium" | "high";
  categorySuggestion:
    | "tarih"
    | "kultur"
    | "sehir"
    | "akademik"
    | "siyaset"
    | "ekonomi"
    | "toplum";
  duplicateRisk: "low" | "medium" | "high";
};

function normalizeSuggestion(raw: unknown): AcademicEntrySuggestionOut | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const suggestedEntryTitle =
    typeof o.suggestedEntryTitle === "string"
      ? o.suggestedEntryTitle.trim()
      : "";
  const reason = typeof o.reason === "string" ? o.reason.trim() : "";

  let suggestedEntryDescription =
    typeof o.suggestedEntryDescription === "string"
      ? o.suggestedEntryDescription.trim()
      : "";
  const descriptionMissing = !suggestedEntryDescription;
  if (descriptionMissing) {
    suggestedEntryDescription = FALLBACK_DESCRIPTION;
  }

  if (!suggestedEntryTitle || !reason) return null;

  const sourcesRaw = Array.isArray(o.sources)
    ? o.sources
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

  let confidenceRaw =
    typeof o.confidence === "string" ? o.confidence.toLowerCase().trim() : "";
  if (!CONFIDENCE_SET.has(confidenceRaw)) confidenceRaw = "low";

  let categoryRaw =
    typeof o.categorySuggestion === "string"
      ? o.categorySuggestion.toLowerCase().trim()
      : "";
  if (!CATEGORY_SET.has(categoryRaw)) categoryRaw = "akademik";

  let riskRaw =
    typeof o.duplicateRisk === "string"
      ? o.duplicateRisk.toLowerCase().trim()
      : "";
  if (!DUPLICATE_RISK_SET.has(riskRaw)) {
    const alt =
      typeof o.siteDuplicateRisk === "string"
        ? o.siteDuplicateRisk.toLowerCase().trim()
        : "";
    riskRaw = DUPLICATE_RISK_SET.has(alt) ? alt : "medium";
  }

  let sourceNote =
    typeof o.sourceNote === "string" ? o.sourceNote.trim() : "";

  let confidence = confidenceRaw as AcademicEntrySuggestionOut["confidence"];

  let sources = sourcesRaw;
  if (sources.length === 0) {
    sources = [];
    confidence = "low";
    sourceNote = SOURCE_VERIFY_PHRASE;
  } else if (descriptionMissing) {
    confidence = "low";
  }

  return {
    suggestedEntryTitle,
    suggestedEntryDescription,
    reason,
    sources,
    sourceNote,
    confidence,
    categorySuggestion:
      categoryRaw as AcademicEntrySuggestionOut["categorySuggestion"],
    duplicateRisk: riskRaw as AcademicEntrySuggestionOut["duplicateRisk"],
  };
}

async function fetchOpenAISuggestions(apiKey: string): Promise<
  | { suggestions: AcademicEntrySuggestionOut[]; httpOk: true }
  | { httpOk: false; apiMessage: string }
> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "Sen Trabzon hakkında akademik içerik üreten bir asistansın.",
          },
          {
            role: "user",
            content: `
Trabzon hakkında akademik ve açık kaynaklı konulara dayanarak TAM OLARAK 8 entry önerisi üret.

SADECE JSON DÖNDÜR.
Açıklama yazma.
Markdown kullanma.

FORMAT:

{
  "suggestions": [
    {
      "suggestedEntryTitle": "...",
      "suggestedEntryDescription": "...",
      "reason": "...",
      "sources": [],
      "sourceNote": "...",
      "confidence": "low",
      "categorySuggestion": "tarih",
      "duplicateRisk": "low"
    }
  ]
}
`,
          },
        ],
        temperature: 0.7,
      }),
    });

    const dataUnknown = await response.json().catch(() => null);
    const data = dataUnknown as {
      choices?: Array<{ message?: { content?: string | null } }>;
      error?: { message?: string };
    } | null;

    if (!response.ok) {
      const apiMsg =
        (typeof data?.error?.message === "string" && data.error.message.trim()
          ? data.error.message.trim()
          : null) ??
        `OpenAI HTTP ${response.status}`;
      console.error("[trabzon-agenda] OpenAI HTTP error:", response.status);
      return { httpOk: false, apiMessage: apiMsg };
    }

    const text = data?.choices?.[0]?.message?.content || "{}";

    let rawSuggestions: unknown = [];

    try {
      const parsed = JSON.parse(text) as { suggestions?: unknown };
      rawSuggestions = parsed.suggestions || [];
    } catch (e) {
      console.error("PARSE ERROR:", text);
      rawSuggestions = [];
    }

    const rawList = Array.isArray(rawSuggestions) ? rawSuggestions : [];

    const normalized: AcademicEntrySuggestionOut[] = [];
    for (const item of rawList) {
      if (normalized.length >= TARGET_COUNT) break;
      const n = normalizeSuggestion(item);
      if (n) normalized.push(n);
    }

    return { suggestions: normalized, httpOk: true };
  } catch (e) {
    console.error("[trabzon-agenda] OpenAI request failed:", e);
    return {
      httpOk: false,
      apiMessage: "OpenAI isteği tamamlanamadı.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
  if (!OPENAI_API_KEY) {
    return NextResponse.json({
      ok: false,
      message: "OpenAI anahtarı tanımlı değil.",
      error: "OpenAI anahtarı tanımlı değil.",
      suggestions: [] satisfies AcademicEntrySuggestionOut[],
    });
  }

  const result = await fetchOpenAISuggestions(OPENAI_API_KEY);
  if (!result.httpOk) {
    return NextResponse.json({
      ok: false,
      message: result.apiMessage,
      error: result.apiMessage,
      suggestions: [] satisfies AcademicEntrySuggestionOut[],
    });
  }

  const suggestions = result.suggestions;

  return NextResponse.json({
    ok: true,
    message: "8 akademik entry önerisi üretildi.",
    suggestions,
    ...(suggestions.length === 0
      ? {
          error:
            "Model yanıtı geçersiz veya öneriler ayrıştırılamadı.",
        }
      : {}),
  });
}
