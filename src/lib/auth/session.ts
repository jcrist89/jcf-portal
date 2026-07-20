import { SignJWT, jwtVerify } from "jose";
import type { Role, SessionUser } from "@/lib/types";

export const SESSION_COOKIE_NAME = "jcf_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days — clients shouldn't have to re-enter a PIN often
const SUPABASE_JWT_TTL_SECONDS = 60 * 10; // 10 min, re-minted per request/poll

function sessionSecret() {
  const secret = process.env.SESSION_COOKIE_SECRET;
  if (!secret) throw new Error("Missing SESSION_COOKIE_SECRET env var.");
  return new TextEncoder().encode(secret);
}

function supabaseSecret() {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error("Missing SUPABASE_JWT_SECRET env var.");
  return new TextEncoder().encode(secret);
}

/** Create the long-lived app session token stored in the httpOnly cookie. */
export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    username: user.username,
    role: user.role,
    fullName: user.fullName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(sessionSecret());
}

/** Verify the app session cookie and return the logged-in user, or null. */
export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      username: (payload.username as string) ?? "",
      role: (payload.role as Role) ?? "client",
      fullName: (payload.fullName as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Mint a short-lived Supabase-compatible JWT for this session so Postgrest/Realtime
 * evaluate RLS as this profile. Must be signed with the project's JWT secret
 * (Project Settings > API > JWT Settings) so auth.uid() resolves correctly.
 */
export async function mintSupabaseJwt(user: SessionUser): Promise<string> {
  return new SignJWT({
    role: "authenticated",
    username: user.username,
    user_role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SUPABASE_JWT_TTL_SECONDS}s`)
    .sign(supabaseSecret());
}
