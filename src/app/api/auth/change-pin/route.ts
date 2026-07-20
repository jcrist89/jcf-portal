import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashPin, verifyPin } from "@/lib/auth/pin";

export async function POST(req: NextRequest) {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const currentPin = String(body?.currentPin ?? "");
  const newPin = String(body?.newPin ?? "");
  if (!/^\d{4,6}$/.test(newPin)) {
    return NextResponse.json({ error: "New PIN must be 4-6 digits." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, pin_hash")
    .eq("id", session.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const ok = await verifyPin(currentPin, profile.pin_hash);
  if (!ok) return NextResponse.json({ error: "Current PIN is incorrect." }, { status: 401 });

  const newHash = await hashPin(newPin);
  const { error } = await admin.from("profiles").update({ pin_hash: newHash }).eq("id", session.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
