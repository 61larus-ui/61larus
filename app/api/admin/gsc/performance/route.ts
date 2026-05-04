import { NextRequest, NextResponse } from "next/server";

const SITE_URL = "sc-domain:61sozluk.com";

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

  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 28);

  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  const start = formatDate(startDate);
  const end = formatDate(endDate);

  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      SITE_URL
    )}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: start,
        endDate: end,
        dimensions: ["query"],
        rowLimit: 25,
        startRow: 0,
      }),
    }
  );

  const data = await res.json();

  return NextResponse.json({
    ok: res.ok,
    status: res.status,
    siteUrl: SITE_URL,
    range: {
      startDate: start,
      endDate: end,
    },
    data,
  });
}
