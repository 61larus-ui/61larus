import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";

export const runtime = "nodejs";

const TRABZON_AGENDA_SCAFFOLD = {
  ok: true as const,
  mode: "manual_sources_first",
  message:
    "Trabzon gündem motoru kaynaklı ve kontrollü çalışacak şekilde hazırlanıyor.",
  principles: [
    "Her gündem önerisi açık kaynakla desteklenmelidir.",
    "Akademik veya güvenilir kaynak yoksa öneri düşük güvenle işaretlenmelidir.",
    "Sistem otomatik entry yayınlamaz; yalnızca admin için öneri üretir.",
  ],
  sourcePlan: [
    {
      type: "official",
      label: "Resmî kurum ve belediye duyuruları",
      status: "planned",
    },
    {
      type: "local_news",
      label: "Yerel haber kaynakları",
      status: "planned",
    },
    {
      type: "academic",
      label: "Akademik ve açık kaynaklar",
      status: "required_for_historical_claims",
    },
  ],
  suggestions: [] as string[],
};

export async function GET() {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;

  return NextResponse.json(TRABZON_AGENDA_SCAFFOLD);
}
