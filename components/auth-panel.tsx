"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  onBeforeOAuth?: () => void;
};

export default function AuthPanel({ onBeforeOAuth }: Props) {
  const supabase = createSupabaseBrowserClient();
  const [oauthError, setOauthError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setOauthError(null);
    onBeforeOAuth?.();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/")}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setOauthError(error.message);
    }
  }

  return (
    <div className="auth-gate-panel">
      <h2 className="auth-gate-title">Giriş</h2>
      <p className="auth-gate-lede m-0">
        Devam etmek için Google hesabın yeterli; ek bir kayıt formu yok.
      </p>
      <div className="auth-oauth-stack">
        <button
          type="button"
          className="auth-oauth-btn"
          onClick={() => void signInWithGoogle()}
        >
          Google ile devam et
        </button>
        {oauthError ? (
          <p className="auth-oauth-error m-0" role="status">
            {oauthError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
