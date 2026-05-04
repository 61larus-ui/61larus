import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("gsc_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing GSC access token cookie. Connect Google first.",
      },
      { status: 401 }
    );
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
