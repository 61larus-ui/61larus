import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { TRABZON_AGENDA_SOURCES } from "@/lib/trabzon-agenda-sources";

export const runtime = "nodejs";

const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_TIMEOUT_MS = 60_000;

const MESSAGE_READY =
  "Trabzon gündem motoru kaynaklı ve kontrollü çalışacak şekilde hazırlanıyor.";
const MESSAGE_NO_GEMINI =
  "Gemini anahtarı olmadığı için gündem önerisi üretilmedi; kaynak altyapısı hazır.";
const ERROR_GEMINI_FAILED = "Gündem önerileri şu anda üretilemedi.";

const FALLBACK_ENTRY_DESCRIPTION =
  "Bu öneri yayınlanmadan önce kaynakla doğrulanmış kısa açıklama hazırlanmalıdır.";
const SOURCE_VERIFY_PHRASE = "Kaynak doğrulaması gerekli.";

const PRINCIPLES = [
  "Her gündem önerisi açık kaynakla desteklenmelidir.",
  "Akademik veya güvenilir kaynak yoksa öneri düşük güvenle işaretlenmelidir.",
  "Sistem otomatik entry yayınlamaz; yalnızca admin için öneri üretir.",
] as const;

const SOURCE_PLAN = [
  {
    type: "official",
    label: "Resmî kurum ve belediye duyuruları",
    status: "planned",
  },
  {
    type: "local_news",
    label: "Yerel haber kaynakları",
    status: "planned",
  },
  {
    type: "academic",
    label: "Akademik ve açık kaynaklar",
    status: "required_for_historical_claims",
  },
] as const;

const AGENDA_SUGGESTIONS_JSON_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      title: { type: "STRING" },
      reason: { type: "STRING" },
      suggestedEntryTitle: { type: "STRING" },
      suggestedEntryDescription: { type: "STRING" },
      sourceIds: { type: "ARRAY", items: { type: "STRING" } },
      sourceNote: { type: "STRING" },
      confidence: { type: "STRING" },
      category: { type: "STRING" },
      siteDuplicateRisk: { type: "STRING" },
    },
    required: [
      "title",
      "reason",
      "suggestedEntryTitle",
      "suggestedEntryDescription",
      "sourceIds",
      "sourceNote",
      "confidence",
      "category",
      "siteDuplicateRisk",
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

const SOURCE_ID_SET = new Set(
  TRABZON_AGENDA_SOURCES.map((s) => s.id)
);

const CONFIDENCE_SET = new Set(["low", "medium", "high"]);
const CATEGORY_SET = new Set([
  "gundem",
  "tarih",
  "kultur",
  "sehir",
  "akademik",
]);

const DUPLICATE_RISK_SET = new Set(["low", "medium", "high"]);

type AgendaSuggestionOut = {
  title: string;
  reason: string;
  suggestedEntryTitle: string;
  suggestedEntryDescription: string;
  sourceIds: string[];
  sourceNote: string;
  confidence: "low" | "medium" | "high";
  category: "gundem" | "tarih" | "kultur" | "sehir" | "akademik";
  siteDuplicateRisk: "low" | "medium" | "high";
};

function mergeSourceNoteWithVerificationRequired(note: string): string {
  const t = note.trim();
  if (t.toLowerCase().includes("kaynak doğrulaması gerekli")) return t;
  return t ? `${t} ${SOURCE_VERIFY_PHRASE}` : SOURCE_VERIFY_PHRASE;
}

function normalizeSuggestion(raw: unknown): AgendaSuggestionOut | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const reason = typeof o.reason === "string" ? o.reason.trim() : "";
  const suggestedEntryTitle =
    typeof o.suggestedEntryTitle === "string"
      ? o.suggestedEntryTitle.trim()
      : "";
  if (!title || !reason || !suggestedEntryTitle) return null;

  let suggestedEntryDescription =
    typeof o.suggestedEntryDescription === "string"
      ? o.suggestedEntryDescription.trim()
      : "";
  const descriptionMissing = !suggestedEntryDescription;
  if (descriptionMissing) {
    suggestedEntryDescription = FALLBACK_ENTRY_DESCRIPTION;
  }

  const rawIds = Array.isArray(o.sourceIds)
    ? o.sourceIds
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const sourceIds = rawIds.filter((id) => SOURCE_ID_SET.has(id));

  let sourceNote =
    typeof o.sourceNote === "string" ? o.sourceNote.trim() : "";

  let confidenceRaw =
    typeof o.confidence === "string" ? o.confidence.toLowerCase().trim() : "";
  if (!CONFIDENCE_SET.has(confidenceRaw)) confidenceRaw = "low";
  let categoryRaw =
    typeof o.category === "string" ? o.category.toLowerCase().trim() : "";
  if (!CATEGORY_SET.has(categoryRaw)) categoryRaw = "gundem";

  let riskRaw =
    typeof o.siteDuplicateRisk === "string"
      ? o.siteDuplicateRisk.toLowerCase().trim()
      : "";
  if (!DUPLICATE_RISK_SET.has(riskRaw)) riskRaw = "medium";

  let confidence = confidenceRaw as AgendaSuggestionOut["confidence"];
  if (sourceIds.length === 0) {
    confidence = "low";
    sourceNote = mergeSourceNoteWithVerificationRequired(sourceNote);
  }
  if (descriptionMissing) {
    confidence = "low";
  }

  return {
    title,
    reason,
    suggestedEntryTitle,
    suggestedEntryDescription,
    sourceIds,
    sourceNote,
    confidence,
    category: categoryRaw as AgendaSuggestionOut["category"],
    siteDuplicateRisk: riskRaw as AgendaSuggestionOut["siteDuplicateRisk"],
  };
}

function buildAgendaPrompt(sourcesJson: string): string {
  return `Sen 61Sözlük için Trabzon odaklı, kontrollü YENİ ENTRY fırsatı önerileri üreten bir yardımcısın.

KURALLAR:
- Her öneri mutlaka 61Sözlük'te henüz işlenmemiş, yeni bir entry fırsatı gibi düşünülmelidir.
- Daha önce sitede yoğun işlenmiş veya tekrar riski yüksek konuları önerme; siteDuplicateRisk alanını buna göre doldur ("low" | "medium" | "high").
- Her öneri için suggestedEntryTitle ve suggestedEntryDescription ZORUNLUDUR.
- suggestedEntryDescription tek kısa paragraf olmalı; giriş metninin özeti gibi, spekülasyondan kaçın.
- Her öneri kaynak mantığı taşımalı; kaynak id'leri yalnızca aşağıdaki listeden seçilmeli. Kaynak yoksa veya zayıfsa confidence "low" olmalı.
- Trabzon ve çevresiyle ilişkili öneriler üret.
- Uydurma güncel olay, uydurma akademik yayın veya sahte kaynak ÜRETME.
- Canlı haber veya bugüne özel spesifik olay iddiasında bulunma.
- Aşağıdaki kaynak listesinde OLMAYAN sitelere veya spesifik haber URL'lerine atıf yapma.
- Tarihî, kültürel veya akademik iddia içeren önerilerde akademik veya açık kaynak ihtiyacını sourceNote içinde AÇIKÇA belirt.
- Sistem otomatik yayın YAPMAZ; yalnızca admin için öneri üretir.
- Tam olarak 3 öneri üret. JSON dizi olarak döndür (başka metin yok).

KAYNAK LİSTESİ (id, label, type, trustLevel, baseUrl, note?):
${sourcesJson}

Her öğe şeması:
- title: kısa iç başlık / tema etiketi
- reason: neden bu yeni entry fırsatı önerildi (genel, doğrulanabilir çerçeve)
- suggestedEntryTitle: sözlük giriş başlığı önerisi (kısa, sözlük formatına uygun)
- suggestedEntryDescription: giriş için tek kısa paragraf açıklama özeti
- sourceIds: yukarıdaki id'lerden bir veya daha fazla (yalnızca listedekiler)
- sourceNote: kaynak türü, doğrulama ve akademik ihtiyaç notları
- confidence: "low" | "medium" | "high" — kaynak yoksa veya zayıfsa mutlaka "low"
- category: "gundem" | "tarih" | "kultur" | "sehir" | "akademik"
- siteDuplicateRisk: "low" | "medium" | "high" — sitede benzer içerik olma ihtimali tahmini`;
}

function sourcesForPrompt() {
  return TRABZON_AGENDA_SOURCES.map((s) => ({
    id: s.id,
    label: s.label,
    type: s.type,
    trustLevel: s.trustLevel,
    baseUrl: s.baseUrl,
    ...(s.note ? { note: s.note } : {}),
  }));
}

async function fetchGeminiSuggestions(
  apiKey: string
): Promise<{ suggestions: AgendaSuggestionOut[]; ok: boolean }> {
  const modelId = resolveGeminiModel();
  const prompt = buildAgendaPrompt(JSON.stringify(sourcesForPrompt(), null, 0));
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
          responseSchema: AGENDA_SUGGESTIONS_JSON_SCHEMA,
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

    const out: AgendaSuggestionOut[] = [];
    for (const item of arr) {
      if (out.length >= 3) break;
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

  const base = {
    ok: true as const,
    mode: "manual_sources_first" as const,
    principles: [...PRINCIPLES],
    sourcePlan: [...SOURCE_PLAN],
    sources: TRABZON_AGENDA_SOURCES,
  };

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({
      ...base,
      message: MESSAGE_NO_GEMINI,
      suggestions: [] as AgendaSuggestionOut[],
    });
  }

  const { suggestions, ok } = await fetchGeminiSuggestions(key);
  if (!ok) {
    return NextResponse.json({
      ...base,
      message: MESSAGE_READY,
      suggestions: [] as AgendaSuggestionOut[],
      error: ERROR_GEMINI_FAILED,
    });
  }

  return NextResponse.json({
    ...base,
    message: MESSAGE_READY,
    suggestions,
  });
}
