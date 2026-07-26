import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Coach-only: create a new client account (name + email). Sends a Supabase
 * invite email so the client sets their own password — same account shape a
 * public signup would create (handle_new_auth_user provisions the profile row). */
export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx || ctx.session.role !== "coach") {
    return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const fullName = String(body?.fullName ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();

  if (!fullName || !email) {
    return NextResponse.json({ error: "Full name and email are required." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "A client with that email already exists." }, { status: 409 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${siteUrl}/reset-password`,
  });
  if (inviteErr || !invited.user) {
    return NextResponse.json({ error: inviteErr?.message ?? "Could not invite client." }, { status: 500 });
  }

  // handle_new_auth_user already created the profiles row (role client, tier free);
  // fill in the name the coach entered.
  const { data: profile, error } = await admin
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", invited.user.id)
    .select("id, email, full_name, role, created_at")
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: error?.message ?? "Could not create client." }, { status: 500 });
  }

  return NextResponse.json({ profile });
}
