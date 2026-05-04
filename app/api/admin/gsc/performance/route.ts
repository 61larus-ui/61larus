import { NextRequest, NextResponse } from "next/server";

const SITE_URL = "sc-domain:61sozluk.com";

function getDateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

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

  const endDate = getDateDaysAgo(1);
  const startDate = getDateDaysAgo(28);

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
        startDate,
        endDate,
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
      startDate,
      endDate,
    },
    data,
  });
}
