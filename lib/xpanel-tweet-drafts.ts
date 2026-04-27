/**
 * X panel tweet taslakları — yalnızca istemci + localStorage.
 */

import type { LarusEntry } from "@/lib/larus-entry-pool";
import { normalizeEntrySlug } from "@/lib/slug";

export const LARUS_TWEET_DRAFTS_KEY = "larus_tweet_drafts";

export type TweetVariant = "hook" | "info" | "debate";

export type TweetDraftStatus = "draft" | "basket" | "shared" | "skipped";

export type TweetDraft = {
  id: string;
  entryId: string;
  entryTitle: string;
  entryUrl: string;
  text: string;
  variant: TweetVariant;
  hasLink: boolean;
  status: TweetDraftStatus;
  createdAt: string;
};

export const TWEET_MAX_LENGTH = 260;

const PUBLIC_ORIGIN = "https://61larus.com";
const TWEET_MAX = TWEET_MAX_LENGTH;
const SLUG_MIN_LEN = 3;

/** Canlı sitede paylaşım URL’si: önce başlık slug’ı, yoksa id. */
export function buildPublicEntryUrl(entry: LarusEntry): string {
  const slug = normalizeEntrySlug(entry.title);
  const path = slug.length >= SLUG_MIN_LEN ? slug : entry.id.trim();
  return `${PUBLIC_ORIGIN}/${path}`;
}

export function normalizeTweetTextForDedupe(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .replace(/https?:\/\/\S+/gi, "")
    .trim();
}

function newDraftId(): string {
  return `td-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clipWords(s: string, maxLen: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > 12 ? cut.slice(0, sp) : cut) + "…";
}

/** Başlığı birebir kopyalamadan içerikten kısa bir özet. */
function contentMicroExcerpt(entry: LarusEntry, maxLen: number): string {
  let t = entry.content.trim().replace(/\s+/g, " ");
  const titleLow = entry.title.trim().toLowerCase();
  if (titleLow.length > 8 && t.toLowerCase().startsWith(titleLow.slice(0, Math.min(40, titleLow.length)))) {
    t = t.slice(Math.min(t.length, entry.title.length)).trim() || entry.content.trim();
  }
  return clipWords(t, maxLen);
}

/** Gövde + isteğe bağlı link; toplam uzunluk max’ı aşmasın. */
function joinTweetBodyAndUrl(body: string, url: string | null, max: number): string {
  if (!url) {
    return body.length <= max ? body : clipWords(body, max);
  }
  const sep = `\n\n${url}`;
  let b = body.trim();
  while (b.length + sep.length > max && b.length > 24) {
    b = clipWords(b, Math.max(24, b.length - 20));
  }
  if (b.length + sep.length > max) {
    return clipWords(url, max);
  }
  return b + sep;
}

function composeHook(entry: LarusEntry, url: string): { text: string; hasLink: boolean } {
  const oz = contentMicroExcerpt(entry, 72);
  let line =
    `61Larus’ta Trabzon’un bilgi, arka plan ve hafıza dokunuşu bir arada. Kısa bir kesit: ${oz} Tam metin:`;
  let text = joinTweetBodyAndUrl(line, url, TWEET_MAX);
  if (text.length > TWEET_MAX || !text.includes(url)) {
    line = `Trabzon odaklı kaynaklı okuma; 61Larus’ta bağlam derlenmiş. Özet: ${clipWords(oz, 50)} Devamı:`;
    text = joinTweetBodyAndUrl(line, url, TWEET_MAX);
  }
  return { text, hasLink: true };
}

function composeInfo(entry: LarusEntry, url: string): { text: string; hasLink: boolean } {
  const oz = contentMicroExcerpt(entry, 80);
  let line = `Okuma notu: Trabzon gündemi ve arşiv üzerinden tek parça halinde. Giriş cümlesi şöyle akıyor — ${oz} Tümü:`;
  let text = joinTweetBodyAndUrl(line, url, TWEET_MAX);
  if (text.length > TWEET_MAX || !text.includes(url)) {
    line = `61Larus arşiv notu: ${clipWords(oz, 56)} Metin:`;
    text = joinTweetBodyAndUrl(line, url, TWEET_MAX);
  }
  return { text, hasLink: true };
}

function composeDebate(entry: LarusEntry, url: string): { text: string; hasLink: boolean } {
  const oz = contentMicroExcerpt(entry, 52);
  let line = `Trabzon tarafında benzer konularda okumalar çoğu zaman ayrışıyor. Bu metindeki vurgu sizde hangi soruyu açıyor? Kısa bağlam: ${oz}`;
  let text = joinTweetBodyAndUrl(line, url, TWEET_MAX);
  if (text.length <= TWEET_MAX && text.includes(url)) {
    return { text, hasLink: true };
  }
  line = `Trabzon’da bu tür metinler etrafında farklı yorumlar birikir. Okuduktan sonra siz hangi noktada kalırsınız?`;
  text = joinTweetBodyAndUrl(line, url, TWEET_MAX);
  if (text.length <= TWEET_MAX && text.includes(url)) {
    return { text, hasLink: true };
  }
  const textOnly = joinTweetBodyAndUrl(line, null, TWEET_MAX);
  return { text: textOnly, hasLink: false };
}

function textAlreadyExists(text: string, existing: TweetDraft[]): boolean {
  const n = normalizeTweetTextForDedupe(text);
  if (n.length < 8) return true;
  return existing.some(
    (d) => d.status !== "skipped" && normalizeTweetTextForDedupe(d.text) === n,
  );
}

function variantBlocked(
  entryId: string,
  variant: TweetVariant,
  existing: TweetDraft[],
): boolean {
  return existing.some(
    (d) =>
      d.entryId === entryId &&
      d.variant === variant &&
      d.status !== "skipped",
  );
}

const VARIANT_ORDER: TweetVariant[] = ["hook", "info", "debate"];

const composers: Record<
  TweetVariant,
  (entry: LarusEntry, url: string) => { text: string; hasLink: boolean }
> = {
  hook: composeHook,
  info: composeInfo,
  debate: composeDebate,
};

/**
 * Bir entry için en fazla 3 taslak (hook, info, debate); çiftleri ve kuralları eler.
 */
export function generateTweetDraftsForEntry(
  entry: LarusEntry,
  existing: TweetDraft[],
): TweetDraft[] {
  const url = buildPublicEntryUrl(entry);
  const createdAt = new Date().toISOString();
  const out: TweetDraft[] = [];

  for (const variant of VARIANT_ORDER) {
    if (variantBlocked(entry.id, variant, existing)) continue;
    const { text, hasLink } = composers[variant](entry, url);
    if (text.length > TWEET_MAX) continue;
    if (hasLink && !text.includes(url)) continue;
    if (textAlreadyExists(text, [...existing, ...out])) continue;
    out.push({
      id: newDraftId(),
      entryId: entry.id,
      entryTitle: entry.title,
      entryUrl: url,
      text,
      variant,
      hasLink,
      status: "draft",
      createdAt,
    });
  }
  return out;
}

function isTweetDraft(x: unknown): x is TweetDraft {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.entryId !== "string") return false;
  if (typeof o.entryTitle !== "string" || typeof o.entryUrl !== "string")
    return false;
  if (typeof o.text !== "string" || typeof o.createdAt !== "string") return false;
  if (!["hook", "info", "debate"].includes(o.variant as string)) return false;
  if (!["draft", "basket", "shared", "skipped"].includes(o.status as string))
    return false;
  if (typeof o.hasLink !== "boolean") return false;
  return true;
}

export function loadTweetDraftsFromStorage(): TweetDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LARUS_TWEET_DRAFTS_KEY);
    if (raw == null || raw === "") return [];
    const p: unknown = JSON.parse(raw);
    if (!Array.isArray(p)) return [];
    return p.filter(isTweetDraft);
  } catch {
    return [];
  }
}

export function saveTweetDraftsToStorage(drafts: TweetDraft[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LARUS_TWEET_DRAFTS_KEY, JSON.stringify(drafts));
  } catch (e) {
    console.warn("[larus_tweet_drafts] yazılamadı:", e);
  }
}

export function variantLabel(v: TweetVariant): string {
  switch (v) {
    case "hook":
      return "Hook";
    case "info":
      return "Bilgi";
    case "debate":
      return "Tartışma";
    default:
      return v;
  }
}
