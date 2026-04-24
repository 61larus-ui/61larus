/**
 * Yönetici / üye API yanıtlarında ham Postgres / PostgREST / şema metni sızdırmaz.
 */
export const ADMIN_FRIENDLY_ACTION_ERROR =
  "İşlem şu an tamamlanamadı. Lütfen biraz sonra tekrar deneyin veya yönetici altyapısını kontrol edin.";

export const ADMIN_FRIENDLY_LIST_ERROR =
  "Üye listesi yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.";

export const ADMIN_SERVICE_KEY_MISSING_MESSAGE =
  "Admin altyapısı eksik: SUPABASE_SERVICE_ROLE_KEY bulunamadı.";

/** Postgres insufficient_privilege — genelde public.users üzerinde service_role UPDATE yok. */
export const ADMIN_USERS_WRITE_FORBIDDEN_MESSAGE =
  "Yönetici işlemi başarısız: veritabanında bu kullanıcı kaydına yazma izni yok. Yönetici, public.users tablosu için service_role rolüne UPDATE yetkisi vermelidir.";

export function isMissingColumnError(err: { code?: string } | null): boolean {
  return err?.code === "42703" || err?.code === "PGRST204";
}

export function isPermissionDeniedError(err: { code?: string } | null): boolean {
  return err?.code === "42501";
}
