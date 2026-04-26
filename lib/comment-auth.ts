import { unstable_noStore } from "next/cache";
import { SILINMIS_KULLANICI_LABEL } from "@/lib/deleted-user-label";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isMissingColumnError } from "@/lib/admin-friendly-error";

export type CommentAuthSnapshot = {
  userId: string | null;
  isAuthenticated: boolean;
  agreementAccepted: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
};

const DEFAULT_SUSPENSION_REASON =
  "Hesabın platform kullanımı yönetici tarafından geçici olarak durduruldu.";

type ProfileRow = {
  first_name?: string | null;
  agreement_accepted?: boolean | null;
  agreement_accepted_at?: string | null;
  is_platform_access_suspended?: boolean | null;
  platform_access_suspended_at?: string | null;
};

/**
 * Minimal auth/agreement/suspension for entry detail (yorum alanı + şerit).
 * Tek kullanıcı satırı; ana sayfa yükü yok.
 */
export async function getCommentAuth(): Promise<CommentAuthSnapshot> {
  unstable_noStore();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      userId: null,
      isAuthenticated: false,
      agreementAccepted: false,
      isSuspended: false,
      suspensionReason: null,
    };
  }

  const baseProfileSelect =
    "agreement_accepted, agreement_accepted_at, first_name";

  let profile: ProfileRow | null = null;

  const r1 = await supabase
    .from("users")
    .select(
      `${baseProfileSelect}, is_platform_access_suspended, platform_access_suspended_at`
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!r1.error && r1.data) {
    profile = r1.data as ProfileRow;
  } else if (r1.error && isMissingColumnError(r1.error)) {
    const r2 = await supabase
      .from("users")
      .select(`${baseProfileSelect}, platform_access_suspended_at`)
      .eq("id", user.id)
      .maybeSingle();
    if (!r2.error && r2.data) {
      profile = r2.data as ProfileRow;
    } else if (r2.error && isMissingColumnError(r2.error)) {
      const r3 = await supabase
        .from("users")
        .select(baseProfileSelect)
        .eq("id", user.id)
        .maybeSingle();
      if (!r3.error) {
        profile = r3.data as ProfileRow;
      }
    }
  }

  let isSuspended = false;
  if (profile) {
    if (profile.is_platform_access_suspended === true) {
      isSuspended = true;
    } else if (profile.is_platform_access_suspended === false) {
      isSuspended = false;
    } else {
      isSuspended =
        typeof profile.platform_access_suspended_at === "string" &&
        profile.platform_access_suspended_at.length > 0;
    }
  }

  let agreementAccepted = false;
  const isSelfServiceAnonymized =
    profile?.first_name === SILINMIS_KULLANICI_LABEL;
  if (isSelfServiceAnonymized) {
    agreementAccepted = false;
  } else {
    if (typeof profile?.agreement_accepted === "boolean") {
      agreementAccepted = profile.agreement_accepted === true;
    } else {
      agreementAccepted = !!profile?.agreement_accepted_at;
    }
  }

  return {
    userId: user.id,
    isAuthenticated: true,
    agreementAccepted,
    isSuspended,
    suspensionReason: isSuspended ? DEFAULT_SUSPENSION_REASON : null,
  };
}
