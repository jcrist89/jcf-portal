import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth/session";
import type { Role, SessionUser } from "@/lib/types";

/** Server-component helper: redirect to /login unless a valid session exists
 * (optionally requiring a specific role). */
export async function requireUser(role?: Role): Promise<SessionUser> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect("/login");
  if (role && session.role !== role) {
    redirect(session.role === "coach" ? "/coach" : "/dashboard");
  }
  return session;
}

export async function getUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  return token ? verifySession(token) : null;
}
