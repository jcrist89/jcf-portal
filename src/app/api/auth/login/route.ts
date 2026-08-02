import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmailOnce } from "@/lib/email/sendWelcome";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, email, full_name, tier, welcome_email_sent_at")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  // Catches clients invited directly by the coach: their first login here is the
  // earliest point their tier (set at invite time) is known and confirmed, so the
  // welcome email fires here rather than at account-creation time. Self-signups
  // already got theirs from /api/signup or the Stripe webhook, so this is a no-op
  // for them (welcome_email_sent_at is already set).
  if (profile.role === "client" && !profile.welcome_email_sent_at) {
    await sendWelcomeEmailOnce(supabase, profile);
  }

  return NextResponse.json({ ok: true, role: profile.role });
}
