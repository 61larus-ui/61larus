"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export const AGREEMENT_COPY = `61Larus Topluluk Sözleşmesi

61Larus; Trabzon eksenli, metin öncelikli bir okuma ve yazım alanıdır. Bu metin, platformu kullanırken uyman beklenen asgari çerçeveyi özetler.

Paylaştığın yazı ve yorumların yürürlükteki mevzuata, başkalarının haklarına ve yayın ilkelerine uygun olması gerekir. Hukuka aykırı veya topluluk düzenini bozan içerikler uyarılmaksızın kaldırılabilir veya erişime kapatılabilir.

Hakaret, tehdit, nefret söylemi ve kimlik üzerinden hedefleme tolere edilmez. Platform, yasal düzenlemeler ve bağlayıcı kararlar çerçevesinde gerekli ölçüde yetkili mercilerle iş birliği yapabilir.

Kullanıcı içeriğinin doğruluğunu garanti etmeyiz; içeriklerin sorumluluğu sahiplerine aittir.

Aşağıdaki kutuyu işaretleyerek bu koşulları okuduğunu ve kabul ettiğini beyan edersin.`;

type Props = {
  onSuccess: () => void | Promise<void>;
};

const MSG_SESSION =
  "Oturumun süresi dolmuş olabilir. Sayfayı yenileyip tekrar giriş yapmayı dene.";

const MSG_SAVE_FAILED =
  "Onayın şu an kaydedilemedi. Bir süre sonra tekrar dene.";

function sleep(ms: number) {
  return new Promise<void>((r) => {
    window.setTimeout(r, ms);
  });
}

function isLikelySchemaCacheOrMissingColumnError(err: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!err) return false;
  const code = String(err.code ?? "");
  if (code === "PGRST204" || code === "42703") return true;
  const m = (err.message ?? "").toLowerCase();
  return (
    m.includes("schema cache") ||
    m.includes("pgrst") ||
    (m.includes("column") &&
      (m.includes("could not find") ||
        m.includes("does not exist") ||
        m.includes("unknown"))) ||
    m.includes("agreement_accepted")
  );
}

export default function AgreementPanel({ onSuccess }: Props) {
  const supabase = createSupabaseBrowserClient();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onContinue() {
    setError(null);
    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        setError(MSG_SESSION);
        return;
      }
      const now = new Date().toISOString();
      const meta = user.user_metadata as {
        full_name?: string;
        avatar_url?: string;
      };
      const nicknameFromGoogle =
        typeof meta?.full_name === "string" && meta.full_name.trim().length > 0
          ? meta.full_name.trim()
          : null;
      const avatarFromGoogle =
        typeof meta?.avatar_url === "string" && meta.avatar_url.trim().length > 0
          ? meta.avatar_url.trim()
          : null;

      const profileExtras = {
        ...(nicknameFromGoogle
          ? {
              first_name: nicknameFromGoogle,
              last_name: null as string | null,
              nickname: nicknameFromGoogle,
              display_name_mode: "real_name" as const,
            }
          : {}),
        ...(avatarFromGoogle ? { avatar_url: avatarFromGoogle } : {}),
      };

      const userEmail = user.email ?? null;
      const { error: ensureError } = await supabase
        .from("users")
        .upsert({ id: user.id, email: userEmail }, { onConflict: "id" });
      if (ensureError) {
        setError(MSG_SAVE_FAILED);
        return;
      }

      const patchFull = {
        agreement_accepted: true,
        agreement_accepted_at: now,
        onboarding_completed_at: now,
        updated_at: now,
        ...profileExtras,
      };

      const patchLegacy = {
        agreement_accepted_at: now,
        onboarding_completed_at: now,
        updated_at: now,
        ...profileExtras,
      };

      async function runUpdate(payload: Record<string, unknown>) {
        return supabase
          .from("users")
          .update(payload)
          .eq("id", user.id)
          .select("id")
          .maybeSingle();
      }

      let { data: row, error: updateError } = await runUpdate(patchFull);

      if (
        updateError &&
        isLikelySchemaCacheOrMissingColumnError(updateError)
      ) {
        await supabase.auth.refreshSession();
        await sleep(450);
        ({ data: row, error: updateError } = await runUpdate(patchFull));
      }

      if (
        updateError &&
        isLikelySchemaCacheOrMissingColumnError(updateError)
      ) {
        ({ data: row, error: updateError } = await runUpdate(patchLegacy));
      }

      if (updateError) {
        setError(MSG_SAVE_FAILED);
        return;
      }
      if (!row) {
        setError(MSG_SAVE_FAILED);
        return;
      }

      await Promise.resolve(onSuccess());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="agreement-gate-panel">
      <h2 className="agreement-gate-title">Topluluk Sözleşmesi</h2>
      <p className="agreement-gate-lede m-0">
        Devam edebilmek için metni okuyup onaylaman yeterli; bir kez kabul
        ettiğinde tekrar gösterilmez.
      </p>
      <div className="agreement-gate-scroll" tabIndex={0}>
        <div className="agreement-gate-copy">{AGREEMENT_COPY}</div>
      </div>
      <label className="agreement-gate-check">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="agreement-gate-checkbox"
        />
        <span className="agreement-gate-check-label">
          Okudum ve kabul ediyorum
        </span>
      </label>
      {error ? (
        <p className="agreement-gate-error m-0" role="status">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!accepted || loading}
        onClick={() => void onContinue()}
        className="auth-oauth-btn agreement-gate-submit"
      >
        {loading ? "Kaydediliyor…" : "Kabul edip devam et"}
      </button>
    </div>
  );
}
