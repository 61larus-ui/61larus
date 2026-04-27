import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";

export const runtime = "nodejs";

/** Cümle başı için ilk harf büyük, gövde için küçük (tr-TR). */
function topicForSentenceStart(raw: string): string {
  const t = raw.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!t) return "";
  const lower = t.toLocaleLowerCase("tr-TR");
  return (
    lower.charAt(0).toLocaleUpperCase("tr-TR") + lower.slice(1)
  );
}

function topicEmbedded(raw: string): string {
  const t = raw.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!t) return "";
  return t.toLocaleLowerCase("tr-TR");
}

function buildTitleSuggestions(topic: string): string[] {
  const start = topicForSentenceStart(topic);
  const mid = topicEmbedded(topic);
  return [
    `${start} neden Trabzon'da beklenenden farklı gelişti?`,
    `${start} Trabzon'da gerçekten neyi anlatır?`,
    `Trabzon'da ${mid} neden şehir hafızasında farklı bir yere sahiptir?`,
  ];
}

export async function POST(req: Request) {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;

  let body: { topic?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic) {
    return NextResponse.json({ error: "Konu gerekli." }, { status: 400 });
  }

  const suggestions = buildTitleSuggestions(topic);
  return NextResponse.json({ suggestions });
}
