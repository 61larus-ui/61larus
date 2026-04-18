"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function createBrowserSupabaseClient() {
  return createSupabaseBrowserClient();
}
