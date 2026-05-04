import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";

export const runtime = "nodejs";

const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_TIMEOUT_MS = 60_000;
const TARGET_COUNT = 8;

const MESSAGE_READY =
  "Akademik entry önerileri üretildi. Yayın sürecinde admin onayı gereklidir.";
const MESSAGE_NO_GEMINI =
  "Gemini anahtarı tanımlı değil; öneri üretilmedi.";
const ERROR_GEMINI_FAILED = "Akademik entry önerileri şu anda üretilemedi.";

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

const ACADEMIC_SUGGESTIONS_JSON_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      suggestedEntryTitle: { type: "STRING" },
      suggestedEntryDescription: { type: "STRING" },
      reason: { type: "STRING" },
      sources: { type: "ARRAY", items: { type: "STRING" } },
      sourceNote: { type: "STRING" },
      confidence: { type: "STRING" },
      categorySuggestion: { type: "STRING" },
      duplicateRisk: { type: "STRING" },
    },
    required: [
      "suggestedEntryTitle",
      "suggestedEntryDescription",
      "reason",
      "sources",
      "sourceNote",
      "confidence",
      "categorySuggestion",
      "duplicateRisk",
    ],
  },
} as const;

function resolveGeminiModel(): string {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_GEMINI_MODEL;
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

function parseSuggestionsJson(text: string): unknown[] | null {
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
  } catch {
    const start = blob.indexOf("[");
    const end = blob.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        const sliced: unknown = JSON.parse(blob.slice(start, end + 1));
        if (Array.isArray(sliced)) return sliced;
      } catch {
        return null;
      }
    }
    return null;
  }
  return null;
}

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
  /* Eski anahtar adı gelirse yakala */
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

function buildAcademicPrompt(): string {
  return `61Sözlük yöneticisi için Gemini görevin: Trabzon ili, tarihi, kültürü, coğrafyası ve toplumu hakkında yayımlanmış veya güvenilir erişimi olan akademik makaleleri, kitap bölümleri, kamu araştırma raporları ve açık erişimli çalışmalar düşünerek YENİ entry fırsatları önermek.

GÖREV: Tam olarak ${TARGET_COUNT} adet öneri üret. Her biri gerçekten var olabilecek veya doğrulanabilir kaynaklara dayalı konular seç; uydurma makale başlığı, uydurma DOI veya hayali olay yazma.

KURALLAR:
- Önerilen metinleri 61Sözlük'e uygun düşün: Türkçe sözlük girişi tarzı.
- Kaynak olarak yalnızca doğrulanabilir referanslar kullan (yayın adı, yazar birliği, kurum, hakemli dergi, açık arşiv, resmî araştırma raporu özeti vb.). Kesin görmediğin spesifik URL uydurma; genel akademik tema ve doğrulanabilir çerçeve yeterliyse bile sources'da elle uydurulmuş http adresi yazma.
- Kaynak çıkmıyorsa sources boş dizi yap; model confidence için "low" ve sourceNote tam olarak şu olmalı: "${SOURCE_VERIFY_PHRASE}"
- suggestedEntryDescription: tek kısa paragraf, yayına yakın ciddilikte yaz; metinde "admin onayı", "otomatik yayınlanmaz" gibi uyarıları YAZMA — bu uyarıları yönetici arayüzü gösterir.
- Tekrar riski için duplicateRisk kullan ("low"|"medium"|"high"): sitede popüler/yoğun işlenmiş klasik başlıklar için "high".
- Çıktı YALNIZCA JSON dizisi olmalı (başka metin veya Markdown yok).

Her öğe alanları (İngilizce anahtar adları kullan — şema zorunlu):
- suggestedEntryTitle: önerilen sözlük başlığı
- suggestedEntryDescription: yayına yakın kalitede tek kısa giriş metni özeti (uyarı içermesin)
- reason: akademik/anlatı olarak neden yeni bir entry için anlamlı
- sources: sıfır veya daha fazla string — URL veya başlık + kurum + yıl vb.
- sourceNote: kaynak tipi veya doğrulama ihtiyacı (${
    SOURCE_VERIFY_PHRASE
  } durumunda birebir)
- confidence: "low" | "medium" | "high"
- categorySuggestion: "tarih" | "kultur" | "sehir" | "akademik" | "siyaset" | "ekonomi" | "toplum"
- duplicateRisk: "low" | "medium" | "high"`;
}

async function fetchGeminiSuggestions(
  apiKey: string
): Promise<{ suggestions: AcademicEntrySuggestionOut[]; ok: boolean }> {
  const modelId = resolveGeminiModel();
  const prompt = buildAcademicPrompt();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelId
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

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
          responseSchema: ACADEMIC_SUGGESTIONS_JSON_SCHEMA,
        },
      }),
    });

    const rawBody: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("[trabzon-agenda] Gemini HTTP error:", res.status);
      return { suggestions: [], ok: false };
    }

    const text = extractGeminiText(rawBody);
    if (!text) {
      return { suggestions: [], ok: false };
    }

    const arr = parseSuggestionsJson(text);
    if (!arr) {
      return { suggestions: [], ok: false };
    }

    const out: AcademicEntrySuggestionOut[] = [];
    for (const item of arr) {
      if (out.length >= TARGET_COUNT) break;
      const n = normalizeSuggestion(item);
      if (n) out.push(n);
    }
    return { suggestions: out, ok: out.length > 0 };
  } catch (e) {
    console.error("[trabzon-agenda] Gemini request failed:", e);
    return { suggestions: [], ok: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({
      ok: true,
      message: MESSAGE_NO_GEMINI,
      suggestions: [] satisfies AcademicEntrySuggestionOut[],
    });
  }

  const { suggestions, ok } = await fetchGeminiSuggestions(key);
  if (!ok) {
    return NextResponse.json({
      ok: true,
      message: MESSAGE_READY,
      suggestions: [] satisfies AcademicEntrySuggestionOut[],
      error: ERROR_GEMINI_FAILED,
    });
  }

  return NextResponse.json({
    ok: true,
    message: MESSAGE_READY,
    suggestions,
  });
}
