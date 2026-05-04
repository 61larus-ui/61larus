import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

export const runtime = "nodejs";

const SITE_BASE = "https://61sozluk.com";
const FETCH_MS = 25_000;

type CheckStatus = "pass" | "warning" | "fail";

type AuditCheck = {
  name: string;
  status: CheckStatus;
  message: string;
};

type AuditIssue = {
  severity: "critical" | "warning";
  title: string;
  detail: string;
  url: string;
};

type AuditSuccessBody = {
  ok: true;
  checkedAt: string;
  auditRunId: string | null;
  summary: {
    score: number;
    checkedUrls: number;
    criticalIssues: number;
    warnings: number;
  };
  checks: AuditCheck[];
  issues: AuditIssue[];
};

async function fetchWithStatus(
  url: string,
  expectBody: boolean
): Promise<{
  status: number;
  ok: boolean;
  body: string | null;
  error: string | null;
}> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "user-agent": "61Sozluk-SeoAudit/1.0",
        accept: expectBody ? "*/*" : "*/*",
      },
    });
    if (expectBody) {
      const body = await res.text();
      return {
        status: res.status,
        ok: res.ok,
        body,
        error: null,
      };
    }
    await res.arrayBuffer().catch(() => undefined);
    return {
      status: res.status,
      ok: res.ok,
      body: null,
      error: null,
    };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "İstek tamamlanamadı (ağ veya zaman aşımı).";
    return { status: 0, ok: false, body: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

function parseSitemapLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const loc = m[1]?.trim();
    if (loc) out.push(loc);
  }
  return out;
}

function isHomeUrl(href: string): boolean {
  try {
    const u = new URL(href);
    if (u.origin !== SITE_BASE) return false;
    const p = u.pathname.replace(/\/+$/, "") || "/";
    return p === "/";
  } catch {
    return false;
  }
}

function isEntrySampleUrl(href: string): boolean {
  try {
    const u = new URL(href);
    if (u.origin !== SITE_BASE) return false;
    if (isHomeUrl(href)) return false;
    return true;
  } catch {
    return false;
  }
}

type EntrySeoSnapshot = {
  url: string;
  title: string | null;
  description: string | null;
};

function parseHtmlTitle(html: string): string {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return (m?.[1] ?? "").replace(/\s+/g, " ").trim();
}

function parseMetaDescription(html: string): string | null {
  const m = html.match(/<meta\s+name="description"\s+content="(.*?)"/i);
  const v = m?.[1]?.trim();
  return v === undefined || v === "" ? null : v;
}

function scoreFromChecksAndIssues(
  checks: AuditCheck[],
  issues: AuditIssue[]
): number {
  let s = 100;
  for (const c of checks) {
    if (c.status === "fail") s -= 28;
    else if (c.status === "warning") s -= 12;
  }
  for (const i of issues) {
    if (i.severity === "critical") s -= 8;
    else s -= 4;
  }
  return Math.max(0, Math.min(100, Math.round(s)));
}

export async function POST() {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;

  const checkedAt = new Date().toISOString();
  const checks: AuditCheck[] = [];
  const issues: AuditIssue[] = [];
  const entrySeo: EntrySeoSnapshot[] = [];
  let checkedUrls = 0;
  let sitemapFetchedOk = false;
  let locs: string[] = [];

  try {
    // A) Ana sayfa
    const home = await fetchWithStatus(`${SITE_BASE}/`, false);
    checkedUrls += 1;
    if (home.error) {
      checks.push({
        name: "Ana sayfa",
        status: "fail",
        message: `İstek hatası: ${home.error}`,
      });
      issues.push({
        severity: "critical",
        title: "Ana sayfa erişilemiyor",
        detail: home.error,
        url: `${SITE_BASE}/`,
      });
    } else if (home.status !== 200) {
      checks.push({
        name: "Ana sayfa",
        status: "fail",
        message: `HTTP ${home.status} (beklenen: 200).`,
      });
      issues.push({
        severity: "critical",
        title: "Ana sayfa beklenen durum kodunu döndürmedi",
        detail: `Sunucu ${home.status} döndü; 200 olmalı.`,
        url: `${SITE_BASE}/`,
      });
    } else {
      checks.push({
        name: "Ana sayfa",
        status: "pass",
        message: "HTTP 200 — ana sayfa erişilebilir.",
      });
    }

    // B) robots.txt
    const robots = await fetchWithStatus(`${SITE_BASE}/robots.txt`, true);
    checkedUrls += 1;
    const hasSitemapMention = /\bsitemap\b/i.test(robots.body ?? "");

    if (robots.error) {
      checks.push({
        name: "robots.txt",
        status: "fail",
        message: `İstek hatası: ${robots.error}`,
      });
      issues.push({
        severity: "critical",
        title: "robots.txt alınamadı",
        detail: robots.error,
        url: `${SITE_BASE}/robots.txt`,
      });
    } else if (robots.status !== 200) {
      checks.push({
        name: "robots.txt",
        status: "fail",
        message: `HTTP ${robots.status} (beklenen: 200).`,
      });
      issues.push({
        severity: "critical",
        title: "robots.txt beklenen durum kodunu döndürmedi",
        detail: `Sunucu ${robots.status} döndü; 200 olmalı.`,
        url: `${SITE_BASE}/robots.txt`,
      });
    } else if (!hasSitemapMention) {
      checks.push({
        name: "robots.txt",
        status: "warning",
        message:
          "HTTP 200 ancak içerikte ‘sitemap’ ifadesi bulunamadı; yapılandırmayı doğrulayın.",
      });
      issues.push({
        severity: "warning",
        title: "robots.txt içinde sitemap referansı",
        detail:
          "Dosya 200 dönüyor fakat içerikte ‘sitemap’ geçmiyor; arama motorları için sitemap satırı beklenir.",
        url: `${SITE_BASE}/robots.txt`,
      });
    } else {
      checks.push({
        name: "robots.txt",
        status: "pass",
        message: "HTTP 200 — içerikte sitemap referansı tespit edildi.",
      });
    }

    // C) sitemap.xml
    const sm = await fetchWithStatus(`${SITE_BASE}/sitemap.xml`, true);
    checkedUrls += 1;
    if (sm.error) {
      checks.push({
        name: "sitemap.xml",
        status: "fail",
        message: `İstek hatası: ${sm.error}`,
      });
      issues.push({
        severity: "critical",
        title: "sitemap.xml alınamadı",
        detail: sm.error,
        url: `${SITE_BASE}/sitemap.xml`,
      });
    } else if (sm.status !== 200) {
      checks.push({
        name: "sitemap.xml",
        status: "fail",
        message: `HTTP ${sm.status} (beklenen: 200).`,
      });
      issues.push({
        severity: "critical",
        title: "sitemap.xml beklenen durum kodunu döndürmedi",
        detail: `Sunucu ${sm.status} döndü; 200 olmalı.`,
        url: `${SITE_BASE}/sitemap.xml`,
      });
    } else {
      const body = sm.body ?? "";
      locs = parseSitemapLocs(body);
      sitemapFetchedOk = true;
      const siteUrls = locs.filter(
        (u) => u.startsWith(`${SITE_BASE}/`) || u.startsWith(SITE_BASE)
      );
      if (siteUrls.length === 0) {
        checks.push({
          name: "sitemap.xml",
          status: "warning",
          message:
            "HTTP 200 fakat https://61sozluk.com tabanlı <loc> öğesi bulunamadı.",
        });
        issues.push({
          severity: "warning",
          title: "Sitemap içeriğinde site URL’leri",
          detail:
            "Sitemap açıldı ancak beklenen biçimde https://61sozluk.com/ ile başlayan adresler yakalanamadı.",
          url: `${SITE_BASE}/sitemap.xml`,
        });
      } else {
        checks.push({
          name: "sitemap.xml",
          status: "pass",
          message: `HTTP 200 — ${siteUrls.length} site URL’si <loc> içinde bulundu.`,
        });
      }
    }

    // D) İlk 10 entry URL örneği
    const entryCandidates = locs.filter(isEntrySampleUrl).slice(0, 10);
    let samplePass = 0;
    let sampleFail = 0;

    if (!sitemapFetchedOk) {
      checks.push({
        name: "Örnek entry URL’leri (ilk 10)",
        status: "warning",
        message:
          "Sitemap alınamadığı veya 200 dönmediği için entry örnekleri test edilmedi.",
      });
    } else if (entryCandidates.length === 0) {
      checks.push({
        name: "Örnek entry URL’leri (ilk 10)",
        status: "warning",
        message:
          "Sitemap’te ana sayfa dışı örnek URL bulunamadı; entry slug’ları listelenmiyor olabilir.",
      });
      issues.push({
        severity: "warning",
        title: "Sitemap’te entry URL örneği yok",
        detail:
          "İlk 10 entry için test yapılamadı; sitemap yalnızca ana sayfa içeriyor olabilir veya biçim farklı.",
        url: `${SITE_BASE}/sitemap.xml`,
      });
    } else {
      let entrySeoCriticalCount = 0;
      let entrySeoWarningCount = 0;

      for (const u of entryCandidates) {
        checkedUrls += 1;
        const r = await fetchWithStatus(u, true);
        if (r.error) {
          sampleFail += 1;
          entrySeo.push({ url: u, title: null, description: null });
          issues.push({
            severity: "critical",
            title: "Entry URL’ine erişilemedi",
            detail: r.error,
            url: u,
          });
        } else if (r.status !== 200) {
          sampleFail += 1;
          entrySeo.push({ url: u, title: null, description: null });
          issues.push({
            severity: "critical",
            title: "Entry URL beklenmeyen durum kodu",
            detail: `HTTP ${r.status} (beklenen: 200).`,
            url: u,
          });
        } else {
          samplePass += 1;
          const html = r.body ?? "";
          const title = parseHtmlTitle(html);
          const description = parseMetaDescription(html);
          entrySeo.push({ url: u, title: title || null, description });

          const titleLen = title.length;
          if (titleLen < 20) {
            entrySeoWarningCount += 1;
            issues.push({
              severity: "warning",
              title: "Title çok kısa",
              detail: `Bulunan değer: ${title}`,
              url: u,
            });
          } else if (titleLen > 70) {
            entrySeoWarningCount += 1;
            issues.push({
              severity: "warning",
              title: "Title çok uzun",
              detail: `Bulunan değer: ${title}`,
              url: u,
            });
          }

          if (description === null) {
            entrySeoCriticalCount += 1;
            issues.push({
              severity: "critical",
              title: "Meta description eksik",
              detail: "Bulunan değer: (yok)",
              url: u,
            });
          } else {
            const descLen = description.length;
            if (descLen < 50) {
              entrySeoWarningCount += 1;
              issues.push({
                severity: "warning",
                title: "Meta description çok kısa",
                detail: `Bulunan değer: ${description}`,
                url: u,
              });
            } else if (descLen > 160) {
              entrySeoWarningCount += 1;
              issues.push({
                severity: "warning",
                title: "Meta description çok uzun",
                detail: `Bulunan değer: ${description}`,
                url: u,
              });
            }
          }
        }
      }

      let entrySeoCheckStatus: CheckStatus = "pass";
      if (entrySeoCriticalCount > 0) entrySeoCheckStatus = "fail";
      else if (entrySeoWarningCount > 0) entrySeoCheckStatus = "warning";

      checks.push({
        name: "Entry SEO Analizi",
        status: entrySeoCheckStatus,
        message: `${entryCandidates.length} entry üzerinde title ve description kontrol edildi`,
      });

      if (sampleFail === 0) {
        checks.push({
          name: "Örnek entry URL’leri (ilk 10)",
          status: "pass",
          message: `${samplePass} URL HTTP 200 döndü.`,
        });
      } else if (samplePass > 0) {
        checks.push({
          name: "Örnek entry URL’leri (ilk 10)",
          status: "warning",
          message: `${samplePass} geçti, ${sampleFail} sorunlu (ayrıntılar sorunlar listesinde).`,
        });
      } else {
        checks.push({
          name: "Örnek entry URL’leri (ilk 10)",
          status: "fail",
          message: `Tüm örnek URL’ler sorunlu (${sampleFail}).`,
        });
      }
    }

    const criticalIssues = issues.filter((i) => i.severity === "critical").length;
    const warnings = issues.filter((i) => i.severity === "warning").length;
    let score = scoreFromChecksAndIssues(checks, issues);

    let auditRunId: string | null = null;
    const service = createSupabaseServiceClient();
    const summaryPayload = {
      score,
      checkedUrls,
      criticalIssues,
      warnings,
    };
    const rawSnapshot = {
      ok: true as const,
      checkedAt,
      summary: summaryPayload,
      checks,
      issues,
      entrySeo,
    };

    if (!service) {
      checks.push({
        name: "Geçmiş kaydı",
        status: "warning",
        message: "Tarama yapıldı fakat geçmiş kaydı oluşturulamadı.",
      });
      score = scoreFromChecksAndIssues(checks, issues);
    } else {
      const { data: inserted, error: insertError } = await service
        .from("seo_audit_runs")
        .insert({
          score,
          checked_urls: checkedUrls,
          critical_issues: criticalIssues,
          warnings,
          checks,
          issues,
          raw_result: rawSnapshot,
        })
        .select("id")
        .maybeSingle();

      if (insertError || !inserted?.id) {
        checks.push({
          name: "Geçmiş kaydı",
          status: "warning",
          message: "Tarama yapıldı fakat geçmiş kaydı oluşturulamadı.",
        });
        score = scoreFromChecksAndIssues(checks, issues);
      } else {
        auditRunId = inserted.id;
      }
    }

    const body: AuditSuccessBody = {
      ok: true,
      checkedAt,
      auditRunId,
      summary: {
        score,
        checkedUrls,
        criticalIssues,
        warnings,
      },
      checks,
      issues,
    };

    return NextResponse.json(body);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Tarama sırasında beklenmeyen hata.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
