/**
 * Paylaşım geçmişi ve tekrar kontrol — larus_distribution_history
 */

export const LARUS_DISTRIBUTION_HISTORY_KEY = "larus_distribution_history";

export type DistributionPlatform = "x" | "facebook";

export type DistributionHistoryAction = "shared" | "skipped" | "archived";

export type DistributionHistorySource = "draft" | "basket" | "plan";

export type DistributionHistoryItem = {
  id: string;
  platform: DistributionPlatform;
  entryId: string;
  entryTitle: string;
  text: string;
  action: DistributionHistoryAction;
  source: DistributionHistorySource;
  createdAt: string;
};

export function normalizeTextForHistory(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?…"'«»()]/g, "");
}

function historyTimeMs(createdAt: string): number {
  return new Date(createdAt).getTime();
}

/** Daha önce herhangi bir platformda Paylaşıldı kaydı olan entry (kalıcı dışlama). */
export function hasEntryEverBeenShared(
  history: DistributionHistoryItem[],
  entryId: string,
): boolean {
  if (!entryId.trim()) return false;
  return history.some(
    (e) => e.action === "shared" && e.entryId === entryId,
  );
}

export function getEverSharedEntryIds(history: DistributionHistoryItem[]): Set<string> {
  const s = new Set<string>();
  for (const e of history) {
    if (e.action === "shared" && e.entryId.trim()) s.add(e.entryId);
  }
  return s;
}

/**
 * Paylaşılmış veya arşivlenmiş (üretilmiş) metinlerle aynı normalize metin tekrar üretilmesin.
 */
export function hasProductionTextBeenUsedBefore(
  history: DistributionHistoryItem[],
  text: string,
): boolean {
  const n = normalizeTextForHistory(text);
  if (n.length < 8) return false;
  return history.some(
    (e) =>
      (e.action === "shared" || e.action === "archived") &&
      normalizeTextForHistory(e.text) === n,
  );
}

/** @deprecated FAZ 7.1 sonrası seçimde kullanılmıyor; geriye dönük okuma için bırakıldı. */
export function hasTextBeenUsedBefore(
  history: DistributionHistoryItem[],
  text: string,
): boolean {
  return hasProductionTextBeenUsedBefore(history, text);
}

function isNearDuplicate(
  a: DistributionHistoryItem,
  b: Omit<DistributionHistoryItem, "id" | "createdAt">,
  createdAt: string,
): boolean {
  if (
    a.platform !== b.platform ||
    a.action !== b.action ||
    a.source !== b.source ||
    a.entryId !== b.entryId
  ) {
    return false;
  }
  if (normalizeTextForHistory(a.text) !== normalizeTextForHistory(b.text)) {
    return false;
  }
  return (
    Math.abs(historyTimeMs(a.createdAt) - historyTimeMs(createdAt)) < 5_000
  );
}

function newHistoryId(): string {
  return `h-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function addDistributionHistoryItem(
  list: DistributionHistoryItem[],
  item: Omit<DistributionHistoryItem, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): DistributionHistoryItem[] {
  const createdAt = item.createdAt ?? new Date().toISOString();
  const body: DistributionHistoryItem = {
    id: item.id ?? newHistoryId(),
    platform: item.platform,
    entryId: item.entryId,
    entryTitle: item.entryTitle,
    text: item.text,
    action: item.action,
    source: item.source,
    createdAt,
  };
  if (
    list.some((e) => isNearDuplicate(e, item, body.createdAt))
  ) {
    return list;
  }
  return [body, ...list];
}

function isItem(x: unknown): x is DistributionHistoryItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string") return false;
  if (o.platform !== "x" && o.platform !== "facebook") return false;
  if (typeof o.entryId !== "string") return false;
  if (typeof o.entryTitle !== "string") return false;
  if (typeof o.text !== "string") return false;
  if (
    o.action !== "shared" &&
    o.action !== "skipped" &&
    o.action !== "archived"
  ) {
    return false;
  }
  if (o.source !== "draft" && o.source !== "basket" && o.source !== "plan") {
    return false;
  }
  if (typeof o.createdAt !== "string") return false;
  return true;
}

export function loadDistributionHistory(): DistributionHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LARUS_DISTRIBUTION_HISTORY_KEY);
    if (raw == null || raw === "") return [];
    const p: unknown = JSON.parse(raw);
    if (!Array.isArray(p)) return [];
    return p.filter(isItem);
  } catch {
    return [];
  }
}

export function saveDistributionHistory(
  h: DistributionHistoryItem[],
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      LARUS_DISTRIBUTION_HISTORY_KEY,
      JSON.stringify(h),
    );
  } catch (e) {
    console.warn("[larus_distribution_history] yazılamadı:", e);
  }
}
