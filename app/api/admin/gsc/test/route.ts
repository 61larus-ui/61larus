import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const accessToken = new URL(request.url).searchParams.get("token");

  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }

  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json();

  return NextResponse.json({
    ok: res.ok,
    status: res.status,
    data,
  });
}
