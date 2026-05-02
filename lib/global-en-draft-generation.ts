/**
 * Generates an English editorial draft from Turkish entry text via OpenAI API.
 * Server-only; requires OPENAI_API_KEY.
 */

export type GlobalEnDraftResult = {
  title_en: string;
  content_en: string;
};

function stripJsonFence(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    const nl = s.indexOf("\n");
    if (nl !== -1) s = s.slice(nl + 1);
    const end = s.lastIndexOf("```");
    if (end !== -1) s = s.slice(0, end).trim();
  }
  return s.trim();
}

export async function generateGlobalEnglishDraft(input: {
  trTitle: string;
  trContent: string;
}): Promise<GlobalEnDraftResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model =
    process.env.OPENAI_GLOBAL_DRAFT_MODEL?.trim() || "gpt-4o-mini";

  const userBlock = [
    `Turkish title:\n${input.trTitle}`,
    "",
    `Turkish body:\n${input.trContent}`,
    "",
    `Rewrite this Turkish entry for an international audience in English.`,
    `Do not translate literally. Explain the concept clearly in one concise paragraph.`,
    `Keep academic tone. Preserve local context of Trabzon.`,
    `No hype or marketing language.`,
    "",
    `Return a JSON object with exactly two string keys:`,
    `"title_en": a short, natural English title for the piece`,
    `"content_en": exactly one concise paragraph of academic English prose`,
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You output only valid JSON with keys title_en and content_en. " +
            "No markdown wrapper. Academic register; factual; Trabzon-specific details preserved.",
        },
        { role: "user", content: userBlock },
      ],
    }),
  });

  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  } | null;

  if (!res.ok) {
    const msg =
      body?.error?.message ||
      `OpenAI request failed (${res.status}).`;
    throw new Error(msg);
  }

  const rawContent = body?.choices?.[0]?.message?.content;
  if (typeof rawContent !== "string" || !rawContent.trim()) {
    throw new Error("Boş model yanıtı.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(rawContent));
  } catch {
    throw new Error("Model yanıtı geçerli JSON değil.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Geçersiz JSON yapısı.");
  }

  const o = parsed as Record<string, unknown>;
  const title_en =
    typeof o.title_en === "string" ? o.title_en.trim() : "";
  const content_en =
    typeof o.content_en === "string" ? o.content_en.trim() : "";

  if (!title_en || !content_en) {
    throw new Error("Model title_en veya content_en döndürmedi.");
  }

  return { title_en, content_en };
}
