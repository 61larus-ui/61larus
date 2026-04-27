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

const X_MAX = 240;
const TITLE_SHORT_MAX = 80;
const FB_MIN = 300;
const FB_MAX = 520;

export const DAILY_COUNT = 5;

const MERAK_HOOK_PREFIXES = [
  "Bu başlık boş değil:",
  "Trabzon’da kimse bunu konuşmuyor:",
  "Bu konu neden sessiz kaldı?",
] as const;

const PROVOKE_LINES = [
  "Bunu biliyorsan yaz, bilmiyorsan öğren.",
  "Bunu konuşmadan geçme.",
  "Bu başlık boş değil.",
  "Bu şehir bunu tartışmalı.",
] as const;

const FB_FILLERS = [
  "Bağlam 61Larus’ta toparlandı; katkılarınla güçlenir.",
  "Kent gündeminde sessiz kalması zor bir not.",
  "Topluluk tarafında okunup tartışılmaya değer bir giriş.",
] as const;

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

/** Paylaşım için kısa başlık (max 80). */
export function shortTitleForSocial(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  if (t.length <= TITLE_SHORT_MAX) return t;
  return `${t.slice(0, TITLE_SHORT_MAX - 1).trim()}…`;
}

function isQuestionTitle(title: string): boolean {
  return /\?\s*$/.test(title.trim());
}

function buildXText(entry: LarusEntry, url: string, seed: number): string {
  const raw = entry.title.replace(/\s+/g, " ").trim();
  const shortT = shortTitleForSocial(raw);
  const isQ = isQuestionTitle(raw);
  let hookLine = isQ
    ? raw
    : MERAK_HOOK_PREFIXES[seed % MERAK_HOOK_PREFIXES.length]!;
  if (hookLine.length > 96) {
    hookLine = `${hookLine.slice(0, 94).trim()}…`;
  }
  const provoke = PROVOKE_LINES[(seed >>> 3) % PROVOKE_LINES.length]!;
  const mid = `61Larus’ta “${shortT}” konusu açıldı.`;

  const assemble = (st: string, hk: string, prLine: string) =>
    `${hk}\n\n61Larus’ta “${st}” konusu açıldı.\n\n${prLine}\n\n${url}`;

  let st = shortT;
  let hk: string = hookLine;
  let pr: string = provoke;
  let text = assemble(st, hk, pr);
  while (text.length > X_MAX && st.length > 20) {
    st = `${st.slice(0, Math.max(20, st.length - 8)).trim()}…`;
    text = assemble(st, hk, pr);
  }
  if (text.length > X_MAX) {
    hk = hk.length > 48 ? `${hk.slice(0, 46)}…` : hk;
    text = assemble(st, hk, pr);
  }
  if (text.length > X_MAX) {
    pr = pr.length > 28 ? `${pr.slice(0, 26)}…` : pr;
    text = assemble(st, hk, pr);
  }
  if (text.length > X_MAX) {
    text = `${hk}\n\n${mid}\n\n${url}`;
  }
  if (text.length > X_MAX) {
    text = `${mid}\n\n${url}`;
  }
  if (text.length > X_MAX) {
    text = `${mid.slice(0, X_MAX - url.length - 2).trim()}…\n${url}`;
  }
  return text;
}

function buildFacebookText(entry: LarusEntry, url: string, seed: number): string {
  const shortT = shortTitleForSocial(entry.title);
  const filler = FB_FILLERS[seed % FB_FILLERS.length]!;
  let body = `Trabzon’da konuşulması gereken bir konu:

“${shortT}”

61Larus’ta bu başlık açıldı.
Bu konuyu bilmiyorsan öğrenebilir, biliyorsan yorumlarınla katkı katabilirsin.

${filler}`;

  let text = `${body}\n\n${url}`;
  if (text.length < FB_MIN) {
    const extra =
      "Bu tür başlıklar kent sohbetinde yer bulduğunda daha iyi okunur; sen de katıl.";
    text = `${body}\n\n${extra}\n\n${url}`;
  }
  if (text.length > FB_MAX) {
    const budget = FB_MAX - url.length - 4;
    let core = text.slice(0, budget).trim();
    const lastNl = core.lastIndexOf("\n");
    if (lastNl > budget * 0.5) core = core.slice(0, lastNl).trim();
    text = `${core}…\n\n${url}`;
  }
  if (!text.includes(url)) {
    text = `${body.slice(0, FB_MAX - url.length - 4).trim()}…\n\n${url}`;
  }
  return text;
}

function newDraftId(platform: string): string {
  return `sd-${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function orderedCandidates(pool: LarusEntry[], dateKey: string, salt: string): LarusEntry[] {
  const sorted = normalizePoolInMemory(pool);
  const take = Math.min(220, sorted.length);
  const slice = sorted.slice(0, take);
  const rand = mulberry32(hashSeed(`${dateKey}::${salt}`));
  shuffleInPlace(slice, rand);
  return slice;
}

/**
 * Günlük 5 entry: paylaşılmış entry’ler asla; forbidden seti sert dışlama.
 */
export function pickEntriesForDailySet(
  pool: LarusEntry[],
  history: DistributionHistoryItem[],
  opts: {
    count: number;
    forbidden: Set<string>;
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
  dateKey: string,
): SocialDraft[] {
  const now = new Date().toISOString();
  const drafts: SocialDraft[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const url = publicEntryUrl(e.id, e.slug);
    let text = "";
    for (let v = 0; v < 16; v++) {
      const seed = hashSeed(`${e.id}::x::${dateKey}::${i}::${v}`);
      text = buildXText(e, url, seed);
      if (!hasProductionTextBeenUsedBefore(history, text)) break;
    }
    if (!text || hasProductionTextBeenUsedBefore(history, text)) {
      text = buildXText(e, url, hashSeed(`${e.id}::xfallback::${i}`));
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

function makeFbDrafts(
  entries: LarusEntry[],
  history: DistributionHistoryItem[],
  dateKey: string,
): SocialDraft[] {
  const now = new Date().toISOString();
  const drafts: SocialDraft[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const url = publicEntryUrl(e.id, e.slug);
    let text = "";
    for (let v = 0; v < 12; v++) {
      const seed = hashSeed(`${e.id}::fb::${dateKey}::${i}::${v}`);
      text = buildFacebookText(e, url, seed);
      if (!hasProductionTextBeenUsedBefore(history, text)) break;
    }
    if (!text || hasProductionTextBeenUsedBefore(history, text)) {
      text = buildFacebookText(e, url, hashSeed(`${e.id}::fbfallback::${i}`));
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
  return {
    date: dateKey,
    x: makeXDrafts(entries, history, dateKey),
    facebook: makeFbDrafts(entries, history, dateKey),
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
 * Hazır taslakları arşivle; paylaşılan slotlar kalır; yeniler aynı index’te üretilir.
 * Arşivlenen entry id’leri sert forbidden — bir daha seçilmez (havuz yeterliyse).
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

  const rotatedOutIds = new Set<string>();
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
    rotatedOutIds.add(x.entryId);
  }

  const mustKeep = new Set<string>();
  for (let i = 0; i < DAILY_COUNT; i++) {
    if (!indicesToReplace.includes(i)) {
      mustKeep.add(current.x[i]!.entryId);
    }
  }

  const forbidden = new Set<string>([...mustKeep, ...rotatedOutIds]);
  const newEntries = pickEntriesForDailySet(pool, hist, {
    count: indicesToReplace.length,
    forbidden,
    preferAvoid: new Set(),
    dateKey: current.date,
    salt: `refresh-${Date.now()}`,
  });

  const nextX = current.x.map((d) => ({ ...d }));
  const nextF = current.facebook.map((d) => ({ ...d }));
  let ni = 0;
  for (const i of indicesToReplace) {
    const e = newEntries[ni++];
    if (!e) continue;
    const url = publicEntryUrl(e.id, e.slug);
    const xText = makeXDrafts([e], hist, `${current.date}::slot${i}`)[0]!.text;
    const fText = makeFbDrafts([e], hist, `${current.date}::slot${i}`)[0]!.text;
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
