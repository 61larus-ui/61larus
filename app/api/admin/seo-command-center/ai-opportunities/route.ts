import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";

export const runtime = "nodejs";

export async function POST() {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({
      ok: false,
      error: "Gemini API key tanımlı değil.",
      opportunities: [],
    });
  }

  return NextResponse.json({
    ok: true,
    mode: "prepared",
    message:
      "Gemini bağlantısı için server route hazır. Gerçek analiz bir sonraki fazda bağlanacak.",
    opportunities: [
      {
        type: "new_entry",
        priority: "high",
        title: "Yeni başlık fırsatları",
        reason:
          "Gündem ve Search Console verileri bağlandığında burada öneriler üretilecek.",
        status: "hazırlanıyor",
      },
      {
        type: "improve_existing",
        priority: "medium",
        title: "Mevcut entry güçlendirme",
        reason:
          "Meta description, iç link ve başlık iyileştirme önerileri burada listelenecek.",
        status: "hazırlanıyor",
      },
    ],
  });
}
