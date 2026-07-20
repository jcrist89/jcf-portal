import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, mintSupabaseJwt, verifySession } from "@/lib/auth/session";

/**
 * Request-scoped Supabase client authenticated as the current app user via a
 * short-lived, freshly-minted Supabase-compatible JWT (see lib/auth/session.ts).
 * RLS policies then see auth.uid() = the logged-in profile id.
 * Returns null if there's no valid session cookie.
 */
export async function supabaseForRequest() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySession(token);
  if (!session) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars.");
  }

  const supabaseJwt = await mintSupabaseJwt(session);

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${supabaseJwt}` } },
  });

  return { client, session };
}
