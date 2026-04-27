import type { SupabaseClient } from "@supabase/supabase-js";

const TITLE_STOPWORDS = new Set([
  "neden",
  "nasıl",
  "ne",
  "mi",
  "mı",
  "mu",
  "mü",
  "gibi",
  "için",
  "ile",
]);

function foldTurkishToAscii(s: string): string {
  return s
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

/**
 * Başlık karşılaştırması için: küçük harf, noktalama kaldırma, Türkçe sadeleştirme,
 * stopword temizliği — çıktı kelimeler boşlukla birleştirilmiş tek satır.
 */
export function normalizeTitle(raw: string): string {
  let s = raw.normalize("NFKC").toLocaleLowerCase("tr-TR").trim();
  s = foldTurkishToAscii(s);
  s = s.replace(/[^\p{L}0-9]+/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return "";
  const words = s.split(" ").filter(Boolean).filter((w) => !TITLE_STOPWORDS.has(w));
  return words.join(" ");
}

function stemSetFromNormalized(normalized: string): Set<string> {
  if (!normalized) return new Set();
  return new Set(
    normalized
      .split(" ")
      .filter(Boolean)
      .map((w) => w.slice(0, Math.min(4, w.length)))
  );
}

/** İlk 4 harf kökleri (normalizeTitle çıktısı üzerinden). */
export function titleStems(title: string): Set<string> {
  return stemSetFromNormalized(normalizeTitle(title));
}

/**
 * Jaccard benzerliği: |A∩B| / |A∪B|. Kökler boşsa 0.
 */
export function titleStemSimilarity(a: string, b: string): number {
  const A = titleStems(a);
  const B = titleStems(b);
  if (A.size === 0 && B.size === 0) return 0;
  let common = 0;
  for (const x of A) {
    if (B.has(x)) common += 1;
  }
  const union = A.size + B.size - common;
  return union === 0 ? 0 : common / union;
}

function titleStemWordArray(normalized: string): string[] {
  if (!normalized) return [];
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((kelime) => kelime.slice(0, Math.min(4, kelime.length)));
}

function longestCommonWordCount(a: string[], b: string[]) {
  let count = 0;
  for (const w of a) {
    if (b.includes(w)) count++;
  }
  return count;
}

const SIMILARITY_THRESHOLD = 0.6;

export const DUPLICATE_TITLE_MESSAGE =
  "Benzer bir başlık zaten var, lütfen farklı bir ifade kullan.";

export function isTitleTooSimilarToAny(newTitle: string, existingTitles: string[]): boolean {
  if (!normalizeTitle(newTitle)) return false;
  const newNorm = normalizeTitle(newTitle);
  const wordsNew = titleStemWordArray(newNorm);
  for (const old of existingTitles) {
    const jaccard = titleStemSimilarity(newTitle, old);
    const wordsOld = titleStemWordArray(normalizeTitle(old));
    const longestCommon = longestCommonWordCount(wordsNew, wordsOld);
    if (longestCommon < 2 && jaccard <= SIMILARITY_THRESHOLD) {
      continue;
    }
    if (jaccard > SIMILARITY_THRESHOLD || longestCommon >= 2) {
      return true;
    }
  }
  return false;
}

const TITLES_PAGE = 1000;

/** entries.title alanlarının tamamı (sayfalı okuma). */
export async function fetchAllEntryTitles(service: SupabaseClient): Promise<string[]> {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await service
      .from("entries")
      .select("title")
      .order("id", { ascending: true })
      .range(from, from + TITLES_PAGE - 1);
    if (error) throw new Error(error.message || "Başlıklar alınamadı.");
    const rows = data ?? [];
    for (const r of rows) {
      const t = (r as { title?: string }).title;
      if (typeof t === "string" && t.trim()) out.push(t);
    }
    if (rows.length < TITLES_PAGE) break;
    from += TITLES_PAGE;
  }
  return out;
}
