import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";

export const runtime = "nodejs";

const ENV_KEYS = [
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_SEARCH_CONSOLE_SITE_URL",
] as const;

function envPresent(key: (typeof ENV_KEYS)[number]): boolean {
  const v = process.env[key]?.trim();
  return Boolean(v && v.length > 0);
}

export async function POST() {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;

  const missing = ENV_KEYS.filter((k) => !envPresent(k));
  if (missing.length > 0) {
    return NextResponse.json({
      ok: false,
      status: "missing_env",
      missing,
      message:
        "Google Search Console bağlantısı için gerekli env değişkenleri eksik.",
    });
  }

  const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL!.trim();

  return NextResponse.json({
    ok: true,
    status: "prepared",
    message:
      "Google Search Console bağlantı bilgileri tanımlı. Gerçek veri çekme bir sonraki fazda bağlanacak.",
    siteUrl,
  });
}
