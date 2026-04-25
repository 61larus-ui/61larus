import { type NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session-cookies";
import { publicSiteEntryUrl } from "@/lib/public-site-entry-url";

function isAllowedPublicUrl(href: string): boolean {
  try {
    const u = new URL(href);
    if (u.protocol !== "https:") return false;
    if (u.host !== "61larus.com") return false;
    return true;
  } catch {
    return false;
  }
}

type Outcome = "ok" | "not_ready" | "pending";

/**
 * Yönetim oturumu: canlı sitede entry URL’ine HTTP isteği (SSRF sınırı: yalnız 61larus.com).
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const urlParam = searchParams.get("url");
  const id = searchParams.get("id");
  const slug = searchParams.get("slug");
  const slugNorm =
    typeof slug === "string" && slug.trim().length > 0
      ? slug.trim()
      : null;

  let target: string;
  if (urlParam) {
    target = urlParam;
  } else if (id && id.trim().length > 0) {
    target = publicSiteEntryUrl(id.trim(), slugNorm);
  } else {
    return NextResponse.json(
      { error: "url or id gerekli" },
      { status: 400 }
    );
  }

  if (!isAllowedPublicUrl(target)) {
    return NextResponse.json({ error: "Geçersiz URL" }, { status: 400 });
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12_000);

  try {
    const r = await fetch(target, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: ac.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "61Larus-Admin-Verify/1.0",
      },
    });
    const status = r.status;
    if (status >= 200 && status < 300) {
      return NextResponse.json({ outcome: "ok" satisfies Outcome, status });
    }
    if (status === 404) {
      return NextResponse.json({
        outcome: "not_ready" satisfies Outcome,
        status,
      });
    }
    return NextResponse.json({
      outcome: "pending" satisfies Outcome,
      status,
    });
  } catch {
    return NextResponse.json({ outcome: "pending" satisfies Outcome });
  } finally {
    clearTimeout(timer);
  }
}
