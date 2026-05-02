export async function pingGoogleSitemap() {
  try {
    const sitemapUrl = "https://61sozluk.com/sitemap.xml";
    const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;

    const res = await fetch(pingUrl, {
      method: "GET",
    });

    console.log("[SITEMAP PING]", {
      ok: res.ok,
      status: res.status,
    });
  } catch (err) {
    console.error("[SITEMAP PING ERROR]", err);
  }
}
