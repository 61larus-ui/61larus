import { getTranslations } from "@/lib/i18n";
import { getInitialLocale } from "@/lib/useLocale";

export function useT(locale?: string) {
  const resolvedLocale = locale ?? getInitialLocale();
  return getTranslations(resolvedLocale);
}
