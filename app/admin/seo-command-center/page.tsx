"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AdminRole } from "@/lib/admin-role";

type SeoModuleCard = {
  title: string;
  description: string;
  status: string;
};

const SEO_MODULES: SeoModuleCard[] = [
  {
    title: "Teknik SEO",
    description:
      "Sitemap, robots, canonical, 404 ve meta kontrolleri burada izlenecek.",
    status: "Hazırlanıyor",
  },
  {
    title: "Google Search Console",
    description:
      "Gösterim, tıklama, sıralama ve index durumu burada analiz edilecek.",
    status: "Bağlantı bekliyor",
  },
  {
    title: "Gündem Motoru",
    description:
      "Google trendleri ve X gündemi 61Sözlük’e uygun başlık fırsatları için taranacak.",
    status: "Planlandı",
  },
  {
    title: "Gemini Analiz",
    description:
      "Toplanan veriler Gemini ile değerlendirilip admin onayına sunulacak.",
    status: "Planlandı",
  },
];

export default function SeoCommandCenterPage() {
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/session", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        username?: string;
        role?: AdminRole;
      };
      if (!res.ok || !data.ok) {
        setSessionOk(false);
        setUsername(null);
        setRole(null);
        return;
      }
      if (data.role !== "super_admin" && data.role !== "editor_admin") {
        setSessionOk(false);
        setUsername(null);
        setRole(null);
        return;
      }
      setSessionOk(true);
      setUsername(typeof data.username === "string" ? data.username : null);
      setRole(data.role ?? null);
    } catch {
      setSessionOk(false);
      setUsername(null);
      setRole(null);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  if (sessionOk === null) {
    return (
      <main className="admin-page flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <p className="admin-loading-text">Oturum kontrol ediliyor…</p>
      </main>
    );
  }

  if (!sessionOk) {
    return (
      <main className="admin-page flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-200">
        <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center">
          <p className="admin-eyebrow">61Sözlük</p>
          <h1 className="mt-2 text-lg font-semibold text-slate-100">
            Bu alan için yönetim oturumu gerekir
          </h1>
          <p className="admin-helper mt-2 text-sm text-slate-400">
            SEO Komuta Merkezi yalnızca giriş yapmış yöneticiler içindir.
          </p>
          <Link
            href="/admin"
            className="admin-btn-text mt-6 inline-flex rounded-lg border border-slate-600 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
          >
            Yönetim paneline dön
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="admin-eyebrow">Yönetim paneli</p>
            <h1 className="admin-title-page">SEO Komuta Merkezi</h1>
            <p className="admin-session-line">
              Oturum:{" "}
              <span className="admin-session-val">{username ?? "—"}</span>
              {" · "}Rol:{" "}
              <span className="admin-session-val">
                {role === "super_admin"
                  ? "Tam yetki (super_admin)"
                  : role === "editor_admin"
                    ? "Editör (editor_admin)"
                    : "—"}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin"
              className="admin-btn-text rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"
            >
              ← Ana panel
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <p className="admin-helper max-w-3xl text-base leading-relaxed text-slate-300">
          {
            "61Sözlük'ün teknik SEO sağlığını, index fırsatlarını ve gündem uyumlu başlık önerilerini tek merkezden yönetmek için hazırlanıyor."
          }
        </p>

        <section
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-6"
          aria-label="SEO güncelle"
        >
          <button
            type="button"
            disabled
            className="rounded-lg border border-slate-600 bg-slate-800/40 px-4 py-2.5 text-sm font-medium text-slate-500 cursor-not-allowed opacity-60"
          >
            SEO GÜNCELLE
          </button>
          <p className="admin-helper mt-2 max-w-xl text-xs text-slate-500">
            Bu buton sonraki fazda teknik taramayı başlatacak.
          </p>
        </section>

        <section aria-label="SEO modülleri">
          <h2 className="admin-section-title mb-4 text-base">Modüller</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SEO_MODULES.map((m) => (
              <article
                key={m.title}
                className="rounded-xl border border-slate-800 bg-slate-900/35 p-5 shadow-none"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">
                    {m.title}
                  </h3>
                  <span className="shrink-0 rounded-full border border-slate-700/90 bg-slate-950/50 px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">
                    {m.status}
                  </span>
                </div>
                <p className="admin-helper mt-3 text-sm leading-relaxed text-slate-400">
                  {m.description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
