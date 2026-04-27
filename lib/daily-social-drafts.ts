/**
 * Günlük X + Facebook taslakları — aynı 5 entry, platforma göre farklı metin.
 * larus_daily_social_drafts + larus_daily_entry_set (localStorage).
 */

import type { LarusEntry } from "@/lib/larus-entry-pool";
import { normalizePoolInMemory } from "@/lib/larus-entry-pool";
import {
  addDistributionHistoryItem,
  getEverSharedEntryIds,
  hasProductionTextBeenUsedBefore,
  saveDistributionHistory,
  type DistributionHistoryItem,
} from "@/lib/distribution-history";

export const LARUS_DAILY_SOCIAL_DRAFTS_KEY = "larus_daily_social_drafts";
export const LARUS_DAILY_ENTRY_SET_KEY = "larus_daily_entry_set";

export type SocialDraft = {
  id: string;
  platform: "x" | "facebook";
  entryId: string;
  entryTitle: string;
  entryUrl: string;
  text: string;
  status: "ready" | "shared" | "skipped";
  createdAt: string;
};

export type DailySocialDraftsPayload = {
  date: string;
  x: SocialDraft[];
  facebook: SocialDraft[];
};

export type DailyEntrySetPayload = {
  date: string;
  entryIds: string[];
};

const X_MAX = 260;
const FB_MAX = 700;
export const DAILY_COUNT = 5;

export function publicEntryUrl(entryId: string, slug?: string | null): string {
  const seg = (slug && String(slug).trim()) || String(entryId).trim();
  return `https://61larus.com/${encodeURI(seg)}`;
}

export function todayYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) >>> 0;
}

function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/** Sosyal metin için kısa, akıcı başlık (birebir uzun kopya değil). */
export function socialSpotTitle(title: string, seed: number): string {
  const t = title.replace(/\s+/g, " ").trim();
  if (!t) return "Bu başlık";
  const cut = t.split(/[—–:|]/)[0]?.trim() ?? t;
  const words = cut.split(/\s+/).filter(Boolean);
  const maxWords = 5 + (seed % 4);
  let out = words.slice(0, maxWords).join(" ");
  if (words.length > maxWords) out = `${out}…`;
  const maxLen = 52 + (seed % 12);
  if (out.length > maxLen) out = `${out.slice(0, maxLen - 1).trim()}…`;
  return out || "Bu başlık";
}

type XPattern = "soru" | "iddia" | "eksik" | "merak" | "hafiza";

const X_PATTERNS: XPattern[] = ["soru", "iddia", "eksik", "merak", "hafiza"];

function buildXText(entry: LarusEntry, url: string, pattern: XPattern, seed: number): string {
  const spot = socialSpotTitle(entry.title, seed);
  const lines: string[] = [];
  switch (pattern) {
    case "soru":
      lines.push(`Trabzon’da bu konu neden bu kadar az konuşuldu?`);
      lines.push("");
      lines.push(`61Larus’ta “${spot}” başlığı açıldı.`);
      lines.push(`Bilmiyorsan öğren, biliyorsan yorumlarınla katkı kat:`);
      lines.push(url);
      break;
    case "iddia":
      lines.push(`Bu başlıkta eksik kalan iddia: kent bunu konuşmadan geçmemeli.`);
      lines.push("");
      lines.push(`61Larus’ta “${spot}” notu açıldı.`);
      lines.push(`Sen ne düşünüyorsun?`);
      lines.push(url);
      break;
    case "eksik":
      lines.push(`Genelde özeti kaçırılan bir parça var — burada toplanmış.`);
      lines.push("");
      lines.push(`61Larus: “${spot}”`);
      lines.push(`Okumadan geçme:`);
      lines.push(url);
      break;
    case "merak":
      lines.push(`Merak uyandıran bir başlık: “${spot}”`);
      lines.push("");
      lines.push(`61Larus’ta açıldı; bakışını yaz:`);
      lines.push(url);
      break;
    case "hafiza":
      lines.push(`Şehir hafızasında yer bulması gereken bir konu.`);
      lines.push("");
      lines.push(`61Larus’ta “${spot}” başlığı işleniyor.`);
      lines.push(`Katıl:`);
      lines.push(url);
      break;
  }
  let text = lines.join("\n").trim();
  if (!text.includes(url)) text = `${text}\n${url}`;
  if (text.length > X_MAX) text = text.slice(0, X_MAX - 1).trim() + "…";
  return text;
}

function buildFacebookText(entry: LarusEntry, url: string, seed: number): string {
  const spot = socialSpotTitle(entry.title, seed + 11);
  const intros = [
    `Trabzon’un hafızasında bu başlık önemli bir yere sahip.`,
    `Bu konu, kentin gündeminde sessiz kalmaması gereken notlardan.`,
    `Topluluk tarafında paylaşılmaya değer bir 61Larus girişi.`,
    `Kısa ama yoğun: bu madde 61Larus’ta bağlamıyla birlikte duruyor.`,
    `Okuyunca “buraya da el atılmalı” dedirten bir başlık.`,
  ];
  const h = hashSeed(`${entry.id}::fb::${seed}`);
  const intro = intros[h % intros.length]!;
  const body = `${intro}

61Larus’ta “${spot}” konulu entry açıldı.
Bu konuyu bilmiyorsan öğrenebilir, biliyorsan yorumlarınla katkı katabilirsin:
${url}`.trim();
  let text = body;
  if (text.length > FB_MAX) text = text.slice(0, FB_MAX - 1).trim() + "…";
  if (!text.includes(url)) text = `${text.slice(0, FB_MAX - url.length - 2).trim()}\n\n${url}`;
  return text;
}

function newDraftId(platform: string): string {
  return `sd-${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Kalite sırasındaki üst dilim + karıştırma. */
function orderedCandidates(pool: LarusEntry[], dateKey: string, salt: string): LarusEntry[] {
  const sorted = normalizePoolInMemory(pool);
  const take = Math.min(220, sorted.length);
  const slice = sorted.slice(0, take);
  const rand = mulberry32(hashSeed(`${dateKey}::${salt}`));
  shuffleInPlace(slice, rand);
  return slice;
}

/**
 * Günlük 5 entry: Paylaşılmış entry’ler asla; aynı gün set içi tekrar yok;
 * Vazgeçildi / Arşivlendi kalıcı engel değil (sadece metin tekrarı kontrolü).
 */
export function pickEntriesForDailySet(
  pool: LarusEntry[],
  history: DistributionHistoryItem[],
  opts: {
    count: number;
    /** Kesin dışlanacak (ör. paylaşılmış slotlar). */
    forbidden: Set<string>;
    /** Mümkünse kaçınılacak (ör. yenilemede eski hazır set). */
    preferAvoid: Set<string>;
    dateKey: string;
    salt: string;
  },
): LarusEntry[] {
  const everShared = getEverSharedEntryIds(history);
  const hard = new Set<string>([...everShared, ...opts.forbidden]);
  const slice = orderedCandidates(pool, opts.dateKey, opts.salt);
  const out: LarusEntry[] = [];
  const picked = new Set<string>();

  const tryFill = (allowAvoided: boolean) => {
    for (const e of slice) {
      if (out.length >= opts.count) break;
      if (hard.has(e.id)) continue;
      if (picked.has(e.id)) continue;
      if (!allowAvoided && opts.preferAvoid.has(e.id)) continue;
      out.push(e);
      picked.add(e.id);
    }
  };

  tryFill(false);
  tryFill(true);
  return out;
}

function makeXDrafts(
  entries: LarusEntry[],
  history: DistributionHistoryItem[],
  startPatternIdx: number,
): SocialDraft[] {
  const now = new Date().toISOString();
  const drafts: SocialDraft[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const url = publicEntryUrl(e.id, e.slug);
    let text = "";
    for (let p = 0; p < X_PATTERNS.length; p++) {
      const pattern = X_PATTERNS[(startPatternIdx + i + p) % X_PATTERNS.length]!;
      const seed = (hashSeed(`${e.id}::x::${i}::${p}`) % 10_000) + p * 3;
      text = buildXText(e, url, pattern, seed);
      if (!hasProductionTextBeenUsedBefore(history, text)) break;
    }
    if (!text || hasProductionTextBeenUsedBefore(history, text)) {
      const spot = socialSpotTitle(e.title, i);
      text = `61Larus’ta “${spot}”\n\n${url}`.trim();
      if (text.length > X_MAX) text = text.slice(0, X_MAX - 1).trim() + "…";
    }
    drafts.push({
      id: newDraftId("x"),
      platform: "x",
      entryId: e.id,
      entryTitle: e.title,
      entryUrl: url,
      text,
      status: "ready",
      createdAt: now,
    });
  }
  return drafts;
}

function makeFbDrafts(entries: LarusEntry[], history: DistributionHistoryItem[]): SocialDraft[] {
  const now = new Date().toISOString();
  const drafts: SocialDraft[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const url = publicEntryUrl(e.id, e.slug);
    let text = "";
    for (let bump = 0; bump < 8; bump++) {
      const seed = (hashSeed(`${e.id}::fb::${i}::${bump}`) % 10_000) + bump * 7;
      text = buildFacebookText(e, url, seed);
      if (!hasProductionTextBeenUsedBefore(history, text)) break;
    }
    if (!text || hasProductionTextBeenUsedBefore(history, text)) {
      const spot = socialSpotTitle(e.title, i + 3);
      text = `61Larus’ta “${spot}” konulu entry.\n\nYorumlarınla katkı katabilirsin:\n${url}`.trim();
      if (text.length > FB_MAX) text = text.slice(0, FB_MAX - 1).trim() + "…";
    }
    drafts.push({
      id: newDraftId("facebook"),
      platform: "facebook",
      entryId: e.id,
      entryTitle: e.title,
      entryUrl: url,
      text,
      status: "ready",
      createdAt: now,
    });
  }
  return drafts;
}

export function buildDraftsFromEntries(
  entries: LarusEntry[],
  history: DistributionHistoryItem[],
  dateKey: string,
): DailySocialDraftsPayload {
  const patternStart = hashSeed(`${dateKey}::pat`) % X_PATTERNS.length;
  return {
    date: dateKey,
    x: makeXDrafts(entries, history, patternStart),
    facebook: makeFbDrafts(entries, history),
  };
}

function isSocialDraft(x: unknown): x is SocialDraft {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string") return false;
  if (o.platform !== "x" && o.platform !== "facebook") return false;
  if (typeof o.entryId !== "string" || typeof o.entryTitle !== "string") return false;
  if (typeof o.entryUrl !== "string" || typeof o.text !== "string") return false;
  if (o.status !== "ready" && o.status !== "shared" && o.status !== "skipped") return false;
  if (typeof o.createdAt !== "string") return false;
  return true;
}

function isPayload(x: unknown): x is DailySocialDraftsPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return false;
  if (!Array.isArray(o.x) || !Array.isArray(o.facebook)) return false;
  return o.x.every(isSocialDraft) && o.facebook.every(isSocialDraft);
}

export function loadDailySocialDraftsFromStorage(): DailySocialDraftsPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LARUS_DAILY_SOCIAL_DRAFTS_KEY);
    if (raw == null || raw === "") return null;
    const p: unknown = JSON.parse(raw);
    if (!isPayload(p)) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveDailySocialDraftsToStorage(payload: DailySocialDraftsPayload): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LARUS_DAILY_SOCIAL_DRAFTS_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("[larus_daily_social_drafts] yazılamadı:", e);
  }
}

function isEntrySetPayload(x: unknown): x is DailyEntrySetPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return false;
  if (!Array.isArray(o.entryIds)) return false;
  return o.entryIds.every((id) => typeof id === "string");
}

export function loadDailyEntrySetFromStorage(): DailyEntrySetPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LARUS_DAILY_ENTRY_SET_KEY);
    if (raw == null || raw === "") return null;
    const p: unknown = JSON.parse(raw);
    if (!isEntrySetPayload(p)) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveDailyEntrySetToStorage(payload: DailyEntrySetPayload): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LARUS_DAILY_ENTRY_SET_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("[larus_daily_entry_set] yazılamadı:", e);
  }
}

export function isCompleteDailyPayload(p: DailySocialDraftsPayload): boolean {
  if (p.x.length !== DAILY_COUNT || p.facebook.length !== DAILY_COUNT) return false;
  for (let i = 0; i < DAILY_COUNT; i++) {
    if (p.x[i]?.entryId !== p.facebook[i]?.entryId) return false;
  }
  return true;
}

/**
 * Yeni gün / boş taslak: 5 entry seç, kaydet, üret.
 */
export function generateFreshDailyDrafts(
  pool: LarusEntry[],
  history: DistributionHistoryItem[],
  dateKey = todayYmd(),
): DailySocialDraftsPayload {
  const entries = pickEntriesForDailySet(pool, history, {
    count: DAILY_COUNT,
    forbidden: new Set(),
    preferAvoid: new Set(),
    dateKey,
    salt: `fresh-${dateKey}`,
  });
  const payload = buildDraftsFromEntries(entries, history, dateKey);
  saveDailyEntrySetToStorage({
    date: dateKey,
    entryIds: payload.x.map((d) => d.entryId),
  });
  return payload;
}

/**
 * Tamamlanmamış taslak: bugünün entry set’inden üret.
 */
export function rebuildDraftsFromStoredEntrySet(
  pool: LarusEntry[],
  history: DistributionHistoryItem[],
  entrySet: DailyEntrySetPayload,
): DailySocialDraftsPayload | null {
  if (entrySet.entryIds.length !== DAILY_COUNT) return null;
  const entries: LarusEntry[] = [];
  for (const id of entrySet.entryIds) {
    const e = pool.find((row) => row.id === id);
    if (!e) return null;
    entries.push(e);
  }
  const payload = buildDraftsFromEntries(entries, history, entrySet.date);
  saveDailySocialDraftsToStorage(payload);
  return payload;
}

/**
 * Hazır taslakları arşivle, paylaşılanlara dokunma, yeni entry + metin üret.
 */
export function archiveReadyAndRegenerate(
  current: DailySocialDraftsPayload,
  pool: LarusEntry[],
  history: DistributionHistoryItem[],
): { payload: DailySocialDraftsPayload; history: DistributionHistoryItem[] } {
  let hist = history;
  const indicesToReplace: number[] = [];
  for (let i = 0; i < DAILY_COUNT; i++) {
    const x = current.x[i];
    const f = current.facebook[i];
    if (!x || !f) continue;
    if (x.status === "shared" || f.status === "shared") continue;
    indicesToReplace.push(i);
  }

  const preferAvoid = new Set<string>();
  for (const i of indicesToReplace) {
    const x = current.x[i]!;
    const f = current.facebook[i]!;
    if (x.status === "ready") {
      hist = addDistributionHistoryItem(hist, {
        platform: "x",
        entryId: x.entryId,
        entryTitle: x.entryTitle,
        text: x.text,
        action: "archived",
        source: "draft",
      });
    }
    if (f.status === "ready") {
      hist = addDistributionHistoryItem(hist, {
        platform: "facebook",
        entryId: f.entryId,
        entryTitle: f.entryTitle,
        text: f.text,
        action: "archived",
        source: "draft",
      });
    }
    preferAvoid.add(x.entryId);
  }

  const mustKeep = new Set<string>();
  for (let i = 0; i < DAILY_COUNT; i++) {
    if (!indicesToReplace.includes(i)) {
      mustKeep.add(current.x[i]!.entryId);
    }
  }

  const forbidden = new Set<string>(mustKeep);
  const newEntries = pickEntriesForDailySet(pool, hist, {
    count: indicesToReplace.length,
    forbidden,
    preferAvoid,
    dateKey: current.date,
    salt: `refresh-${Date.now()}`,
  });

  const nextX = current.x.map((d) => ({ ...d }));
  const nextF = current.facebook.map((d) => ({ ...d }));
  const patternStart = hashSeed(`${current.date}::refr`) % X_PATTERNS.length;
  let ni = 0;
  for (const i of indicesToReplace) {
    const e = newEntries[ni++];
    if (!e) continue;
    const url = publicEntryUrl(e.id, e.slug);
    const xText = makeXDrafts([e], hist, patternStart + i)[0]!.text;
    const fText = makeFbDrafts([e], hist)[0]!.text;
    const now = new Date().toISOString();
    nextX[i] = {
      id: newDraftId("x"),
      platform: "x",
      entryId: e.id,
      entryTitle: e.title,
      entryUrl: url,
      text: xText,
      status: "ready",
      createdAt: now,
    };
    nextF[i] = {
      id: newDraftId("facebook"),
      platform: "facebook",
      entryId: e.id,
      entryTitle: e.title,
      entryUrl: url,
      text: fText,
      status: "ready",
      createdAt: now,
    };
  }

  const payload: DailySocialDraftsPayload = {
    date: current.date,
    x: nextX,
    facebook: nextF,
  };
  saveDailyEntrySetToStorage({
    date: current.date,
    entryIds: nextX.map((d) => d.entryId),
  });
  saveDistributionHistory(hist);
  return { payload, history: hist };
}
