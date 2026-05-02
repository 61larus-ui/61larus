export type SupportedLocale = "tr" | "en";

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
  en: {
    brand_name: "61Larus",
    search_placeholder: "What are you looking for?",
    search_titles_people_places_topics:
      "Search titles, people, places or topics",
    read_more: "read more",
    login: "Log in",
    login_short: "Login",
    logout: "Log out",
    logout_short: "Logout",
    loading: "Loading",
    search_loading: "Searching…",
    no_results: "No results found.",
    no_title_found: "No title found",
    start_typing_to_search: "Start typing to search",
    comments_count: "comments",
    entry: "entry",
    author: "Author",
    date: "Date",
    contributions: "My contributions",
    memory_added: "Added to memory",
    today_on_61larus: "Today on {brand}",
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
