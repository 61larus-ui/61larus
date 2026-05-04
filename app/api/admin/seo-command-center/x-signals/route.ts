import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";

export const runtime = "nodejs";

const X_SIGNALS_SCAFFOLD = {
  ok: true as const,
  mode: "manual_review_first" as const,
  message:
    "X sinyal motoru, sosyal gündemi doğrudan entry'ye çevirmeden önce filtrelemek için hazırlanıyor.",
  principles: [
    "X sinyalleri tek başına kaynak kabul edilmez.",
    "Trend olan konu önce Trabzon bağlamı ve güvenilir kaynaklarla doğrulanmalıdır.",
    "Sistem otomatik entry yayınlamaz; yalnızca admin için sinyal üretir.",
  ],
  signalPlan: [
    {
      type: "trend",
      label: "Trend konu ve hashtag sinyalleri",
      status: "planned",
    },
    {
      type: "local_discussion",
      label: "Trabzon odaklı yerel konuşmalar",
      status: "planned",
    },
    {
      type: "verification",
      label: "Güvenilir kaynakla doğrulama",
      status: "required_before_entry",
    },
  ],
  signals: [] as unknown[],
};

export async function GET() {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;

  return NextResponse.json(X_SIGNALS_SCAFFOLD);
}
