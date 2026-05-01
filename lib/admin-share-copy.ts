/** Admin panel “paylaşım metni” — yerel, API yok, sonunda ` {LINK}` placeholder. */

const LINK_PLACEHOLDER = " {LINK}";
const MAX_LEN = 280;

/** Uzun öbekler önce. */
const FORBIDDEN: readonly string[] = [
  "şok olacaksınız",
  "inanamayacaksınız",
  "herkes bunu konuşuyor",
  "sır gibi saklandı",
  "olay oldu",
];

function stripForbidden(s: string): string {
  let t = s;
  for (const phrase of FORBIDDEN) {
    if (!phrase) continue;
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    t = t.replace(re, " ");
  }
  t = t.replace(/\bbomba\b/gi, " ");
  return t.replace(/\s{2,}/g, " ").trim();
}

function firstExcerpt(s: string, max: number): string {
  const one = s.replace(/\s+/g, " ").trim();
  if (!one) return "";
  if (one.length <= max) return one;
  const cut = one.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  const base = sp > 24 ? cut.slice(0, sp) : cut;
  return base.trimEnd() + "…";
}

function withLink(body: string): string {
  let b = stripForbidden(body.trim());
  if (!b) b = "61Sözlük'te yeni bir yazı.";
  let full = b + LINK_PLACEHOLDER;
  if (full.length > MAX_LEN) {
    const maxBody = MAX_LEN - LINK_PLACEHOLDER.length;
    b = b.slice(0, maxBody);
    const sp = b.lastIndexOf(" ");
    if (sp > 20) b = b.slice(0, sp);
    b = stripForbidden(b);
    if (!b.endsWith("…") && !b.endsWith("….")) b = b + "…";
    full = b + LINK_PLACEHOLDER;
    if (full.length > MAX_LEN) {
      b = stripForbidden(b.slice(0, maxBody - 1)) + "…";
      full = b + LINK_PLACEHOLDER;
    }
  }
  return full.length <= MAX_LEN ? full : full.slice(0, MAX_LEN);
}

export type ShareCopyVariant = "safe" | "curious" | "bold";

export type ShareCopyItem = {
  key: ShareCopyVariant;
  label: string;
  text: string;
};

/**
 * Başlık + içerikten üç ton üretir; toplam uzunluk 280’i aşmaz, sonunda ` {LINK}`.
 */
export function buildShareCopySuggestions(
  title: string,
  content: string
): ShareCopyItem[] {
  const titleT = (title || "").trim() || "Bu yazı";
  const ex = firstExcerpt(content, 130);

  const safeBody = ex
    ? `${titleT}. ${ex}`
    : `${titleT}. 61Sözlük'te yayındaki metin, bilgilendirme amaçlıdır.`;

  const curiousBody = `«${titleT}» — tamamı ve ayrıntılar bu yazıda; buradaki sadece yönlendirme, tüm cevabı vermez.`;

  const boldBody = `«${titleT}» — net tespitler ve bağlam okumak için tam metin linkte.`;

  return [
    { key: "safe", label: "Güvenli", text: withLink(safeBody) },
    { key: "curious", label: "Meraklı", text: withLink(curiousBody) },
    { key: "bold", label: "İddialı", text: withLink(boldBody) },
  ];
}
