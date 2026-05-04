import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json({ error: "Missing client id" }, { status: 500 });
  }

  const redirectUri = "https://61sozluk.com/api/admin/gsc/oauth/callback";

  const scope = encodeURIComponent(
    "https://www.googleapis.com/auth/webmasters.readonly"
  );

  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth" +
    `?client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code` +
    `&scope=${scope}` +
    `&access_type=offline` +
    `&prompt=consent`;

  return NextResponse.redirect(authUrl);
}
