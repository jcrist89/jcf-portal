import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyPin, normalizeUsername } from "@/lib/auth/pin";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = normalizeUsername(body?.username ?? "");
  const pin = String(body?.pin ?? "");

  if (!username || !pin) {
    return NextResponse.json({ error: "Username and PIN are required." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, username, pin_hash, role, full_name, is_active")
    .eq("username", username)
    .maybeSingle();

  if (error || !profile || !profile.is_active) {
    return NextResponse.json({ error: "Invalid username or PIN." }, { status: 401 });
  }

  const ok = await verifyPin(pin, profile.pin_hash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid username or PIN." }, { status: 401 });
  }

  const token = await createSessionToken({
    id: profile.id,
    username: profile.username,
    role: profile.role,
    fullName: profile.full_name,
  });

  const res = NextResponse.json({
    ok: true,
    role: profile.role,
    onboardingRequired: false,
  });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return res;
}
