export type SupportedLocale = "tr";

export const DEFAULT_LOCALE: SupportedLocale = "tr";

const translations = {
  tr: {
    brand_name: "61Larus",
    search_placeholder: "Ne arıyorsun?",
    search_titles_people_places_topics: "Başlık, kişi, yer veya konu ara",
    read_more: "Devamını oku",
    login: "Giriş yap",
    login_short: "Giriş",
    logout: "Çıkış yap",
    logout_short: "Çıkış",
    loading: "Yükleniyor",
    search_loading: "Aranıyor…",
    no_results: "Sonuç bulunamadı.",
    no_title_found: "Başlık bulunamadı",
    start_typing_to_search: "Aramak için yazmaya başla",
    comments_count: "yorum",
    entry: "entry",
    author: "Yazar",
    date: "Tarih",
    contributions: "Katkılarım",
    memory_added: "Hafızaya eklenenler",
    today_on_61larus: "Bugün {brand}'te",
  },
} as const;

export type TranslationMessages = (typeof translations)[SupportedLocale];

export function isSupportedLocale(value: string): value is SupportedLocale {
  return value === "tr";
}

export function getTranslations(locale?: string): TranslationMessages {
  if (locale !== undefined && isSupportedLocale(locale)) {
    return translations[locale];
  }
  return translations[DEFAULT_LOCALE];
}
