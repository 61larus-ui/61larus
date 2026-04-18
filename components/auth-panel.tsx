"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  onBeforeOAuth?: () => void;
};

export default function AuthPanel({ onBeforeOAuth }: Props) {
  const supabase = createSupabaseBrowserClient();
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const redirectTo = `${origin}/auth/callback?next=/`;

  async function signInWithGoogle() {
    onBeforeOAuth?.();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  }

  return (
    <div
      style={{
        maxWidth: "520px",
        margin: "0 auto",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "20px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        padding: "24px 24px 26px 24px",
      }}
    >
      <h2
        style={{
          fontSize: "36px",
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
          marginTop: 0,
          marginBottom: "8px",
        }}
      >
        Giriş
      </h2>
      <p
        style={{
          fontSize: "16px",
          lineHeight: 1.5,
          color: "var(--text-secondary)",
          opacity: 0.85,
          marginTop: 0,
          marginBottom: "20px",
        }}
      >
        Devam etmek için bir hesap sağlayıcısı seçin.
      </p>
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        className="cursor-pointer hover:bg-[rgba(255,255,255,0.10)] hover:border-[color:var(--border-strong)] active:translate-y-px"
        style={{
          width: "100%",
          height: "48px",
          marginTop: "4px",
          borderRadius: "999px",
          border: "1px solid var(--border-subtle)",
          background: "rgba(255,255,255,0.06)",
          color: "var(--text-primary)",
          fontSize: "15px",
          fontWeight: 600,
          transition: "var(--transition)",
          boxShadow: "none",
        }}
      >
        Google ile devam et
      </button>
    </div>
  );
}
