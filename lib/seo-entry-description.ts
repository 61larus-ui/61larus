/** Postgres `uuid` / Supabase filters: RFC4122-shaped ids. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRfc4122Uuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function normalizeMetaWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[\t\n\f\r]+/g, " ")
    .replace(/ +/g, " ")
    .trim();
}

const DEFAULT_META_DESCRIPTION_MAX = 155;

/**
 * Trims to a typical meta description length, preferring a word boundary
 * when a long token would otherwise be cut mid-word.
 */
export function trimMetaDescription(
  text: string,
  maxLen = DEFAULT_META_DESCRIPTION_MAX
): string {
  const t = normalizeMetaWhitespace(text);
  if (t.length <= maxLen) return t;
  const hard = t.slice(0, maxLen);
  const lastSpace = hard.lastIndexOf(" ");
  const end =
    lastSpace > Math.floor(maxLen * 0.55) ? lastSpace : maxLen;
  return normalizeMetaWhitespace(hard.slice(0, end));
}

/**
 * Builds a meta description from entry fields: primary source is body text;
 * short bodies are combined with the title for a fuller snippet.
 */
export function buildEntryMetaDescription(
  title: string,
  content: string,
  maxLen = DEFAULT_META_DESCRIPTION_MAX
): string {
  const t = normalizeMetaWhitespace(title);
  const c = normalizeMetaWhitespace(content);

  if (c.length === 0) {
    return t.length > 0 ? trimMetaDescription(t, maxLen) : "";
  }

  if (t.length > 0 && c.length < 72) {
    return trimMetaDescription(`${t}. ${c}`, maxLen);
  }

  return trimMetaDescription(c, maxLen);
}
