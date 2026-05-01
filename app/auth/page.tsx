"use client";

import Link from "next/link";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { SITE_BRAND } from "@/lib/entry-seo-metadata";

export default function AuthPage() {
  const supabase = createSupabaseBrowserClient();
  const [oauthError, setOauthError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setOauthError(null);
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
    <main className="auth-page py-6 md:py-8">
      <header className="auth-page-header">
        <Link href="/" className="auth-page-wordmark site-wordmark">
          {SITE_BRAND}
        </Link>
        <p className="auth-page-tagline m-0">
          Trabzon’un gündemi, lafı ve hafızası
        </p>
      </header>

      <div className="auth-page-body">
        <div className="auth-gate-panel">
          <h1 className="auth-gate-title">Giriş</h1>
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
      </div>
    </main>
  );
}
