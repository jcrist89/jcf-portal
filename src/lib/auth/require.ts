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
  return session;
}

export async function getUser(): Promise<AppUser | null> {
  const ctx = await supabaseForRequest();
  return ctx?.session ?? null;
}
