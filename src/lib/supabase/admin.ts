import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS entirely — only ever import this into
 * server-only code (route handlers / server actions), never into client components.
 * Used for: PIN login lookup (before we have a session/JWT to authenticate with),
 * and coach-only administrative writes where it's simpler to trust the server-side
 * role check than re-derive a scoped client.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
