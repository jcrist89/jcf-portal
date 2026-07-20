import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySession, mintSupabaseJwt } from "@/lib/auth/session";

/** Issues a short-lived Supabase-compatible JWT for the browser's realtime client. */
export async function GET() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const supabaseJwt = await mintSupabaseJwt(session);
  return NextResponse.json({ token: supabaseJwt, user: session });
}
