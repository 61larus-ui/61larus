import { SILINMIS_KULLANICI_LABEL } from "@/lib/deleted-user-label";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export async function anonymizeCurrentUserAccount(): Promise<{
  error: string | null;
}> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: "Oturum bulunamadı." };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("users")
    .update({
      first_name: SILINMIS_KULLANICI_LABEL,
      last_name: null,
      nickname: null,
      display_name_mode: "real_name",
      avatar_url: null,
      email: null,
      birth_date: null,
      gender: null,
      phone: null,
      bio_61: null,
      /** Aynı auth id ile tekrar girişte sözleşme hukuken yeni kabul gibi ele alınsın. */
      agreement_accepted: false,
      agreement_accepted_at: null,
      onboarding_completed_at: null,
      updated_at: now,
    })
    .eq("id", user.id);

  if (updateError) {
    return { error: updateError.message };
  }

  const { data: files } = await supabase.storage.from("avatars").list(user.id);
  if (files?.length) {
    const paths = files.map((f: { name: string }) => `${user.id}/${f.name}`);
    await supabase.storage.from("avatars").remove(paths);
  }

  return { error: null };
}
