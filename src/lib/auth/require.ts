import { redirect } from "next/navigation";
import { supabaseForRequest, type RequestContext } from "@/lib/supabase/server";
import type { Role, AppUser } from "@/lib/types";

/** Server-component helper: redirect to /login unless a valid session exists
 * (optionally requiring a specific role).
 *
 * Returns the whole request context — client, session, and profile row — because
 * resolving any one of them already resolved all three. Pages should destructure
 * what they need from this rather than calling supabaseForRequest() again, which
 * would repeat both the auth.getUser() round-trip and the profiles select. */
export async function requireUser(role?: Role): Promise<RequestContext> {
  const ctx = await supabaseForRequest();
  if (!ctx) redirect("/login");
  const { session } = ctx;
  if (role && session.role !== role) {
    redirect(session.role === "coach" ? "/coach" : "/dashboard");
  }
  // A client who hasn't finished onboarding (interrupted signup, or a coach-invited
  // client who set a password but never completed their profile) shouldn't land on
  // any client page other than /onboarding itself — send them back to finish it.
  // Scoped to callers that explicitly require the "client" role (dashboard, program,
  // achievements, progress, messages, billing); requireUser() with no role (e.g.
  // settings) stays reachable regardless of onboarding state.
  if (role === "client" && !session.onboarded) {
    redirect("/onboarding");
  }
  return ctx;
}

export async function getUser(): Promise<AppUser | null> {
  const ctx = await supabaseForRequest();
  return ctx?.session ?? null;
}
