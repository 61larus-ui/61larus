export type SupportedLocale = "tr" | "en";

export const DEFAULT_LOCALE: SupportedLocale = "tr";

const translations = {
  tr: {
    brand_name: "61Larus",
    search_placeholder: "Başlık ara",
    read_more: "Devamını oku",
    login: "Giriş yap",
    logout: "Çıkış yap",
    loading: "Yükleniyor",
    no_results: "Sonuç bulunamadı",
    contributions: "Katkılarım",
    memory_added: "Hafızaya eklenenler",
    today_on_61larus: "Bugün 61Larus’ta",
  },
  en: {
    brand_name: "61Larus",
    search_placeholder: "Search title",
    read_more: "read more",
    login: "Log in",
    logout: "Log out",
    loading: "Loading",
    no_results: "No results found",
    contributions: "My contributions",
    memory_added: "Added to memory",
    today_on_61larus: "Today on 61Larus",
  },
} as const;

export type TranslationMessages = (typeof translations)[SupportedLocale];

export function isSupportedLocale(value: string): value is SupportedLocale {
  return value === "tr" || value === "en";
}

export function getTranslations(locale?: string): TranslationMessages {
  if (locale !== undefined && isSupportedLocale(locale)) {
    return translations[locale];
  }
  return translations[DEFAULT_LOCALE];
}
