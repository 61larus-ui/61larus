import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type SupportedLocale,
} from "@/lib/i18n";

const LANG_STORAGE_KEY = "lang";

export function getInitialLocale(): SupportedLocale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }
  const raw = window.localStorage.getItem(LANG_STORAGE_KEY);
  if (raw !== null && isSupportedLocale(raw)) {
    return raw;
  }
  return DEFAULT_LOCALE;
}

export function setLocale(locale: SupportedLocale): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LANG_STORAGE_KEY, locale);
}
