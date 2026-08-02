import { redirect } from "next/navigation";
import { supabaseForRequest } from "@/lib/supabase/server";
import type { Role, AppUser } from "@/lib/types";

/** Server-component helper: redirect to /login unless a valid session exists
 * (optionally requiring a specific role). */
export async function requireUser(role?: Role): Promise<AppUser> {
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
  return session;
}

export async function getUser(): Promise<AppUser | null> {
  const ctx = await supabaseForRequest();
  return ctx?.session ?? null;
}
