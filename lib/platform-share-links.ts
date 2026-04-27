/**
 * Manuel paylaşım: güvenli dış (intent / sharer) linkleri, otomatik paylaşım yok.
 */

const X_INTENT = "https://twitter.com/intent/tweet";
const FB_SHARE = "https://www.facebook.com/sharer/sharer.php";

/**
 * `text` içinde http(s) linki varken ayrı `url` sorgu parametresi eklenmez;
 * tüm metin `text` ile gönderilir.
 */
export function buildXIntentUrl(text: string): string {
  return `${X_INTENT}?text=${encodeURIComponent(text)}`;
}

export function buildFacebookShareUrl(entryUrl: string): string {
  return `${FB_SHARE}?u=${encodeURIComponent(entryUrl)}`;
}

export function openShareWindow(url: string): void {
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}
