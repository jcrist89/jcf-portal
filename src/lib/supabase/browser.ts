"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client backed by the real Supabase Auth session (synced via
 * cookies with the server client). supabase-js keeps the Realtime socket's auth
 * token in sync automatically as the session refreshes, so callers don't need to
 * manually re-mint or refresh anything before subscribing.
 */
let cached: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (cached) return cached;
  cached = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return cached;
}
