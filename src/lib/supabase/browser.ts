"use client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client authenticated with a short-lived JWT fetched from
 * /api/auth/token. Used for Realtime subscriptions (coach live dashboard).
 * The token expires after ~10 min, so callers should periodically refresh it
 * via refreshBrowserAuth().
 */
let cached: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  cached = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export async function refreshBrowserAuth(): Promise<void> {
  const res = await fetch("/api/auth/token");
  if (!res.ok) return;
  const { token } = await res.json();
  const client = getBrowserClient();
  await client.realtime.setAuth(token);
}
