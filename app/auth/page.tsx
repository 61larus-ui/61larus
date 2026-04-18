"use client";

import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function AuthPage() {
  const supabase = createSupabaseBrowserClient();
  const redirectTo = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`;

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  }

  return (
    <main className="flex flex-1 flex-col bg-transparent py-8 text-[#1F2937] md:py-10">
      <header className="mb-10 border-b border-[#E7E5E4]/70 pb-8 text-center md:mb-12 md:pb-10">
        <Link
          href="/"
          className="inline-block text-4xl font-semibold tracking-tight text-[#1F2937] transition-colors hover:text-[#5F7A61] md:text-5xl"
        >
          61larus
        </Link>
        <p className="mx-auto mt-3 max-w-md text-sm font-normal leading-6 text-[#667085]">
          Trabzon’un gündemi, lafı ve hafızası
        </p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-[#E7E5E4] bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h1 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
            Giriş
          </h1>
          <p className="text-center text-sm font-normal leading-6 text-[#667085]">
            Devam etmek için bir hesap sağlayıcısı seçin.
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm font-medium text-[#1F2937] transition-colors hover:bg-[#F4F3F0]"
            >
              Google ile devam et
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
