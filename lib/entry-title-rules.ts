/** Başlık kalitesi: yasaklı başlangıçlar (boş başlık burada değil, "Başlık gerekli." ile ayrı). */
export function validateTitleQuality(title: string): string | null {
  const t = title.trim();
  if (!t) {
    return null;
  }

  const forbiddenStarts = ["ne zaman", "nasıl", "kimdir", "nedir"];

  const lower = t.toLocaleLowerCase("tr-TR");

  for (const f of forbiddenStarts) {
    if (lower.startsWith(f)) {
      return "Bu başlık tarzı yasaklı (ne zaman / nasıl / kimdir). Daha özgün yaz.";
    }
  }

  return null;
}
