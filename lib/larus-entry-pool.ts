/**
 * FAZ 1 — istemci içerik tarama + localStorage.
 * İstekler /__larus_ingest/* üzerinden next.config rewrites ile proxy edilir (CORS yok).
 */

export const LARUS_ENTRIES_POOL_KEY = "larus_entries_pool";

/** 61Sözlük içerik havuzu maddesi (panel genişletmeleri için alanlar opsiyonel). */
export type LarusEntry = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  category?: string;
  /** Varsa genelde kamuya açık URL yolu slug’ı. */
  slug?: string;
  usedCount: number;
  lastUsedAt?: string;
  isEvergreen?: boolean;
};

const INGEST_BASE = "/__larus_ingest";

/**
 * Geniş arama sözlüğü: tek “kategoriye” sıkışmadan site aramasından örneklem.
 * Her çekimde karıştırılarak farklı sıra denenir.
 */
const SEARCH_TERMS = [
  "trabzon",
  "rize",
  "artvin",
  "giresun",
  "gümüşhane",
  "bayburt",
  "erzurum",
  "ordu",
  "samsun",
  "sinop",
  "kastamonu",
  "bolu",
  "sakarya",
  "kocaeli",
  "istanbul",
  "ankara",
  "izmir",
  "bursa",
  "antalya",
  "adana",
  "gaziantep",
  "diyarbakır",
  "mardin",
  "van",
  "erzincan",
  "muş",
  "ağrı",
  "kars",
  "ardahan",
  "batman",
  "siirt",
  "şırnak",
  "hakkari",
  "tarih",
  "gündem",
  "siyaset",
  "ekonomi",
  "spor",
  "kültür",
  "sanat",
  "eğitim",
  "sağlık",
  "çevre",
  "ulaşım",
  "enerji",
  "imar",
  "belediye",
  "mahalle",
  "köy",
  "şehir",
  "bölge",
  "karadeniz",
  "akdeniz",
  "ege",
  "marmara",
  "iç anadolu",
  "doğu anadolu",
  "güneydoğu",
  "kadın",
  "çocuk",
  "gençlik",
  "emek",
  "işçi",
  "işsizlik",
  "asgari ücret",
  "sendika",
  "grev",
  "miting",
  "protesto",
  "trabzonspor",
  "futbol",
  "basketbol",
  "voleybol",
  "maraton",
  "stad",
  "taraftar",
  "hafıza",
  "anı",
  "arşiv",
  "belge",
  "müze",
  "kitap",
  "yazar",
  "şiir",
  "tiyatro",
  "sinema",
  "müzik",
  "festival",
  "hukuk",
  "adalet",
  "mahkeme",
  "polis",
  "itfaiye",
  "afad",
  "deprem",
  "sel",
  "yangın",
  "güvenlik",
  "liman",
  "havalimanı",
  "otoyol",
  "köprü",
  "tünel",
  "metro",
  "tramvay",
  "otobüs",
  "feribot",
  "üniversite",
  "okul",
  "hastane",
  "aile hekimi",
  "aşı",
  "pandemi",
  "ormancılık",
  "balıkçılık",
  "tarım",
  "çay",
  "fındık",
  "limon",
  "zeytin",
  "hayvancılık",
  "turizm",
  "otel",
  "pansiyon",
  "restoran",
  "kafe",
  "meydan",
  "cami",
  "kilise",
  "sinagog",
  "imar planı",
  "parsel",
  "tapu",
  "kentsel dönüşüm",
  "toki",
  "konut",
  "kira",
  "seçim",
  "meclis",
  "parti",
  "oy",
  "anket",
  "yorum",
  "analiz",
  "röportaj",
  "basın",
  "teknoloji",
  "internet",
  "dijital",
  "yapay zeka",
  "veri",
  "startup",
  "iklim",
  "geri dönüşüm",
  "atık",
  "su",
  "elektrik",
  "doğalgaz",
  "yenilenebilir",
  "61larus",
  "61sozluk",
  "larus",
  "sozluk",
  "entry",
  "not",
  "günlük",
  "katkı",
  "topluluk",
  "of ilçe",
  "sürmene",
  "akçaabat",
  "araklı",
  "tonya",
  "yomra",
  "çarşıbaşı",
  "şalpazarı",
  "düzköy",
  "hayrat",
  "köprübaşı",
  "dernekpazarı",
  "maçka",
  "osmanlı",
  "cumhuriyet",
  "kurtuluş",
  "göç",
  "mübadele",
  "nostalji",
  "kent belleği",
  "şehir hikayesi",
  "gönüllü",
  "stk",
  "dernek",
  "vakıf",
  "kooperatif",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
] as const;
const MIN_CONTENT_LEN = 100;
/** Üst sınır: ayrıntı sayfası çekimi maliyetli; havuz 500’e kadar büyüyebilir. */
const MAX_STUBS_TO_FETCH = 320;
const DETAIL_CONCURRENCY = 6;

/** Havuzda tutulacak üst sınır (normalize + localStorage). */
export const MAX_POOL_ENTRIES = 1000;

/** Sadece sıralama için; modele yazılmaz. */
function entryQualityScore(e: LarusEntry): number {
  let score = Math.min(e.content.length, 4000);
  const t = e.title.trim();
  if (t.endsWith("?")) score += 50;
  if (t.length > 35) score += 30;
  return score;
}

function sortByCreatedDesc(a: LarusEntry, b: LarusEntry): number {
  const ta = new Date(a.created_at).getTime();
  const tb = new Date(b.created_at).getTime();
  const aNa = Number.isNaN(ta);
  const bNa = Number.isNaN(tb);
  if (aNa && bNa) return a.id.localeCompare(b.id);
  if (aNa) return 1;
  if (bNa) return -1;
  if (tb !== ta) return tb - ta;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

function sortPoolByQuality(entries: LarusEntry[]): LarusEntry[] {
  return [...entries].sort((a, b) => {
    const dq = entryQualityScore(b) - entryQualityScore(a);
    if (dq !== 0) return dq;
    return sortByCreatedDesc(a, b);
  });
}

function pickLaterLastUsed(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

/** Aynı id tekrarlarında kullanım alanlarını birleştirir (son gelen başlık/içerik öncelikli). */
function dedupeById(entries: LarusEntry[]): LarusEntry[] {
  const m = new Map<string, LarusEntry>();
  for (const e of entries) {
    const x = m.get(e.id);
    if (!x) {
      m.set(e.id, e);
      continue;
    }
    const slug = e.slug?.trim() || x.slug?.trim();
    m.set(e.id, {
      ...e,
      ...(slug ? { slug } : {}),
      usedCount: Math.max(x.usedCount, e.usedCount),
      lastUsedAt: pickLaterLastUsed(x.lastUsedAt, e.lastUsedAt),
      isEvergreen: x.isEvergreen ?? e.isEvergreen,
    });
  }
  return [...m.values()];
}

/**
 * Tekilleştir → kalite + tarih sırasına göre sırala → üst sınır (MAX_POOL_ENTRIES).
 * localStorage ve state için ortak çıktı.
 */
export function normalizePoolInMemory(entries: LarusEntry[]): LarusEntry[] {
  const deduped = dedupeById(entries);
  const sorted = sortPoolByQuality(deduped);
  return sorted.slice(0, MAX_POOL_ENTRIES);
}

/** Ağdan gelen kayıt ile mevcut havuz satırını birleştirir (usedCount / lastUsedAt korunur). */
export function mergeFreshIntoPrior(
  fresh: LarusEntry,
  prior?: LarusEntry,
): LarusEntry {
  const slug =
    (fresh.slug?.trim() || prior?.slug?.trim() || undefined) ?? undefined;
  if (!prior) {
    return {
      id: fresh.id,
      title: fresh.title,
      content: fresh.content,
      created_at: fresh.created_at,
      category: fresh.category,
      usedCount: fresh.usedCount,
      lastUsedAt: fresh.lastUsedAt,
      isEvergreen: fresh.isEvergreen,
      ...(slug ? { slug } : {}),
    };
  }
  return {
    id: fresh.id,
    title: fresh.title,
    content: fresh.content,
    created_at: fresh.created_at,
    category: fresh.category ?? prior.category,
    usedCount: prior.usedCount,
    lastUsedAt: prior.lastUsedAt,
    isEvergreen: prior.isEvergreen ?? fresh.isEvergreen,
    ...(slug ? { slug } : {}),
  };
}

/** Önceki havuz + yeni çekilen; id çakışmasında içerik güncellenir, kullanım alanları korunur. */
export function mergeAndNormalizePool(
  prior: LarusEntry[],
  freshlyFetched: LarusEntry[],
): LarusEntry[] {
  const byId = new Map<string, LarusEntry>();
  for (const e of prior) {
    byId.set(e.id, e);
  }
  for (const e of freshlyFetched) {
    const merged = mergeFreshIntoPrior(e, byId.get(e.id));
    byId.set(e.id, merged);
  }
  return normalizePoolInMemory([...byId.values()]);
}

type SearchRow = {
  id: string;
  title: string;
  category?: string;
  created_at: string;
};

function isUuidLike(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id.trim(),
  );
}

function extractOgDescription(html: string): string {
  if (typeof document === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const og = doc
    .querySelector('meta[property="og:description"]')
    ?.getAttribute("content");
  if (og && og.trim()) return og.trim();
  const meta = doc
    .querySelector('meta[name="description"]')
    ?.getAttribute("content");
  return meta?.trim() ?? "";
}

async function searchEntriesRaw(term: string): Promise<SearchRow[]> {
  const url = `${INGEST_BASE}/api/search-entries?q=${encodeURIComponent(term)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`search-entries failed: ${res.status} ${term}`);
  }
  const data: unknown = await res.json();
  if (!data || typeof data !== "object" || !("results" in data)) return [];
  const results = (data as { results: unknown }).results;
  if (!Array.isArray(results)) return [];
  const out: SearchRow[] = [];
  for (const row of results) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.title !== "string") continue;
    if (!isUuidLike(r.id)) continue;
    const created =
      typeof r.created_at === "string" ? r.created_at : new Date().toISOString();
    const category = typeof r.category === "string" ? r.category : undefined;
    out.push({ id: r.id, title: r.title.trim(), category, created_at: created });
  }
  return out;
}

async function fetchEntryPageHtml(id: string): Promise<string> {
  const url = `${INGEST_BASE}/entry/${encodeURIComponent(id)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`entry page ${res.status} ${id}`);
  }
  return res.text();
}

function shuffleArray<T>(arr: T[], seed = Date.now()): T[] {
  const out = [...arr];
  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker(): Promise<void> {
    while (i < items.length) {
      const idx = i;
      i += 1;
      const item = items[idx];
      const r = await fn(item);
      if (r != null) out.push(r);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return out;
}

function parseApiEntriesPayload(json: unknown): LarusEntry[] | null {
  if (!json || typeof json !== "object" || !("entries" in json)) return null;
  const raw = (json as { entries: unknown }).entries;
  if (!Array.isArray(raw)) return null;
  const out: LarusEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.title !== "string") continue;
    if (typeof o.content !== "string" || typeof o.created_at !== "string")
      continue;
    const title = o.title.trim();
    const content = o.content.trim();
    if (!title || content.length < MIN_CONTENT_LEN) continue;
    const used =
      typeof o.usedCount === "number" && !Number.isNaN(o.usedCount)
        ? o.usedCount
        : 0;
    out.push({
      id: o.id,
      title,
      content,
      created_at: o.created_at,
      usedCount: used,
      ...(typeof o.category === "string" && o.category.trim()
        ? { category: o.category.trim() }
        : {}),
      ...(typeof o.slug === "string" && o.slug.trim()
        ? { slug: o.slug.trim() }
        : {}),
    });
  }
  return dedupeById(out);
}

/**
 * Önce `/xpanel/api/entries` (Supabase); başarısız veya boşsa arama/proxy scrape.
 */
async function fetchEntriesFromDatabaseApi(): Promise<LarusEntry[] | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/xpanel/api/entries", { cache: "no-store" });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const parsed = parseApiEntriesPayload(json);
    if (!parsed || parsed.length === 0) return null;
    return parsed;
  } catch (e) {
    console.warn("[fetchEntries] API atlandı:", e);
    return null;
  }
}

/**
 * Arama + madde HTML’sinden og:description ile içerik (fallback).
 */
async function fetchEntriesViaScrape(): Promise<LarusEntry[]> {
  const seen = new Set<string>();
  const stubs: SearchRow[] = [];
  const terms = shuffleArray([
    ...new Set(SEARCH_TERMS as unknown as string[]),
  ]);

  for (const term of terms) {
    let rows: SearchRow[] = [];
    try {
      rows = await searchEntriesRaw(term);
    } catch (e) {
      console.warn("[fetchEntries] arama atlandı:", term, e);
      continue;
    }
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      stubs.push(row);
      if (stubs.length >= MAX_STUBS_TO_FETCH) break;
    }
    if (stubs.length >= MAX_STUBS_TO_FETCH) break;
  }

  const built = await mapWithConcurrency(stubs, DETAIL_CONCURRENCY, async (s) => {
    try {
      const html = await fetchEntryPageHtml(s.id);
      const content = extractOgDescription(html);
      if (!content || content.length < MIN_CONTENT_LEN) return null;
      const entry: LarusEntry = {
        id: s.id,
        title: s.title,
        content,
        created_at: s.created_at,
        ...(s.category ? { category: s.category } : {}),
        usedCount: 0,
      };
      return entry;
    } catch (e) {
      console.warn("[fetchEntries] madde atlandı:", s.id, e);
      return null;
    }
  });

  return dedupeById(built);
}

/**
 * 61Sözlük entry havuzu: önce veritabanı API’si, yoksa scrape.
 */
export async function fetchEntries(): Promise<LarusEntry[]> {
  const fromDb = await fetchEntriesFromDatabaseApi();
  if (fromDb && fromDb.length > 0) return fromDb;
  return fetchEntriesViaScrape();
}

function isLarusEntry(x: unknown): x is LarusEntry {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.title !== "string") return false;
  if (typeof o.content !== "string" || typeof o.created_at !== "string")
    return false;
  if (typeof o.usedCount !== "number" || Number.isNaN(o.usedCount)) return false;
  if ("slug" in o && o.slug != null && typeof o.slug !== "string") return false;
  return true;
}

export function loadEntriesPoolFromStorage(): LarusEntry[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LARUS_ENTRIES_POOL_KEY);
    if (raw == null || raw === "") return null;
    const p: unknown = JSON.parse(raw);
    if (!Array.isArray(p) || p.length === 0) return null;
    const valid = p.filter(isLarusEntry);
    if (valid.length === 0) return null;
    const normalized = normalizePoolInMemory(valid);
    if (normalized.length === 0) return null;
    saveEntriesPoolToStorage(normalized);
    return normalized;
  } catch {
    return null;
  }
}

export function saveEntriesPoolToStorage(entries: LarusEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizePoolInMemory(entries);
    localStorage.setItem(LARUS_ENTRIES_POOL_KEY, JSON.stringify(normalized));
  } catch (e) {
    console.warn("[larus_entries_pool] yazılamadı:", e);
  }
}

export function contentPreview(text: string, maxLen = 140): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}
