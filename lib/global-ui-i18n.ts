import { getTranslations } from "@/lib/i18n";

/**
 * Geçici sabit TR — kök layout / üst client component olmadan altyapı bağlantısı.
 * Dinamik dil seçimi eklendiğinde burası güncellenebilir.
 */
export function getGlobalUiTranslations() {
  return getTranslations("tr");
}
