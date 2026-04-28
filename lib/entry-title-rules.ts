export function validateTitleQuality(title: string) {
  const t = title.trim();

  // yasaklı başlangıçlar
  const forbiddenStarts = ["ne zaman", "nasıl", "kimdir", "nedir"];

  const lower = t.toLocaleLowerCase("tr-TR");

  for (const f of forbiddenStarts) {
    if (lower.startsWith(f)) {
      return "Bu başlık tarzı yasaklı (ne zaman / nasıl / kimdir). Daha özgün yaz.";
    }
  }

  // soru formatı zorunlu
  if (!t.includes("?")) {
    return "Başlık soru formatında olmalı.";
  }

  return null;
}
