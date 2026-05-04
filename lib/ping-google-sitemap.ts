const SITE_ORIGIN = "https://61sozluk.com";

const sitemapUrl = `${SITE_ORIGIN}/sitemap.xml`;

const googlePingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;

/**
 * Google’a sitemap güncellemesini bildirir (Indexing API değil; ping URL).
 */
export async function pingGoogleSitemap(): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
}> {
  try {
    const response = await fetch(googlePingUrl, { method: "GET" });
    const ok = response.ok;
    if (ok) {
      console.log("[sitemap-ping] success");
    } else {
      console.log("[sitemap-ping] failed");
    }
    return { ok, status: response.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log("[sitemap-ping] failed");
    return { ok: false, error: message };
  }
}
