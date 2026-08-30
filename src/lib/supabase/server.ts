import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppUser, Profile } from "@/lib/types";
import { DEFAULT_TIMEZONE } from "@/lib/localDate";

/**
 * Everything a page or route handler needs about the current request, resolved
 * once: the RLS-bound client, the merged auth+profile session, and the full
 * profile row. `profile` is included so callers that need columns beyond the
 * session summary (program_id, weights, goal, billing fields) don't re-query a
 * row that was already fetched to build the session.
 */
export interface RequestContext {
  client: SupabaseClient;
  session: AppUser;
  profile: Profile;
}

/**
 * Request-scoped Supabase client bound to the real Supabase Auth session cookie.
 * RLS policies see auth.uid() = the signed-in user's id directly — no custom JWT minting.
 */
export function createClient(): SupabaseClient {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render — middleware refreshes the
            // session cookie on the next request instead.
          }
        },
      },
    }
  );
}

/**
 * Convenience wrapper used across pages/route handlers: returns the request-scoped
 * client plus the merged auth + profile user, or null if there's no signed-in user.
 *
 * Pages should reach this through requireUser() rather than calling it directly —
 * requireUser() calls this internally, so doing both costs a duplicate
 * auth.getUser() round-trip and a duplicate profiles select on every render.
 */
export async function supabaseForRequest(): Promise<RequestContext | null> {
  const client = createClient();
  const {
    data: { user: authUser },
  } = await client.auth.getUser();
  if (!authUser) return null;

  const { data: profile } = await client
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!profile) return null;

  const session: AppUser = {
    id: authUser.id,
    email: profile.email ?? authUser.email ?? "",
    role: profile.role,
    fullName: profile.full_name,
    tier: profile.tier,
    onboarded: profile.onboarded,
    timezone: profile.timezone || DEFAULT_TIMEZONE,
  };

  return { client, session, profile: profile as Profile };
}
