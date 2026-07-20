import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generatePin, hashPin, normalizeUsername } from "@/lib/auth/pin";

/** Coach-only: create a new client account (name + auto or custom PIN). */
export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx || ctx.session.role !== "coach") {
    return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const fullName = String(body?.fullName ?? "").trim();
  const username = normalizeUsername(body?.username ?? "");
  const pin = body?.pin ? String(body.pin) : generatePin(6);

  if (!fullName || !username) {
    return NextResponse.json({ error: "Full name and username are required." }, { status: 400 });
  }
  if (!/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be 4-6 digits." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }

  const pinHash = await hashPin(pin);
  const { data: profile, error } = await admin
    .from("profiles")
    .insert({
      role: "client",
      username,
      pin_hash: pinHash,
      full_name: fullName,
    })
    .select("id, username, full_name, role, created_at")
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: error?.message ?? "Could not create client." }, { status: 500 });
  }

  return NextResponse.json({ profile, pin });
}
