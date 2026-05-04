import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.response;

  const service = createSupabaseServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY tanımlanmalıdır." },
      { status: 503 }
    );
  }

  const { data, error } = await service
    .from("seo_audit_runs")
    .select("id, created_at, score, checked_urls, critical_issues, warnings")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Geçmiş alınamadı." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, runs: data ?? [] });
}
