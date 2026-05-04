import { NextResponse } from "next/server";

export async function GET() {
  const accessToken = "BURAYA_ACCESS_TOKEN_YAPIŞTIR";

  const res = await fetch(
    "https://www.googleapis.com/webmasters/v3/sites",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await res.json();

  return NextResponse.json({
    ok: true,
    data,
  });
}
