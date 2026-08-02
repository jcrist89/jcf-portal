import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe, TIER_PRICE_IDS } from "@/lib/stripe";
import { sendWelcomeEmailOnce } from "@/lib/email/sendWelcome";
import type { Goal, Tier } from "@/lib/types";

const GOALS: Goal[] = ["strength_gain", "fat_loss", "hybrid", "powerlifting"];
const TIERS: Tier[] = ["free", "paid_programming", "paid_coaching"];

/**
 * Public self-signup. Creates the Supabase Auth user + profile immediately
 * (auto-confirmed — the user just set their own password, so there's no need
 * to also gate on an email click before they can start onboarding) and signs
 * them in. Free tier is provisioned right away; paid tiers stay on `tier=free`
 * until Stripe's webhook confirms payment — this also means an abandoned
 * Checkout never grants entitlement, and the profile row (with email/name/goal
 * already saved) is itself the record of an incomplete paid signup Jon can
 * follow up on.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const fullName = String(body.fullName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const goal = body.goal as Goal;
  const tier = body.tier as Tier;

  if (!fullName || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (!GOALS.includes(goal)) {
    return NextResponse.json({ error: "Invalid goal." }, { status: 400 });
  }
  if (!TIERS.includes(tier)) {
    return NextResponse.json({ error: "Invalid tier." }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr || !created.user) {
    return NextResponse.json({ error: createErr?.message ?? "Could not create account." }, { status: 500 });
  }
  const userId = created.user.id;

  // Auto-assign the goal's default template as this client's own program instance.
  const { data: template } = await admin
    .from("programs")
    .select("*")
    .eq("goal", goal)
    .eq("is_default_template", true)
    .maybeSingle();

  let programId: string | null = null;
  if (template) {
    const { data: instance } = await admin
      .from("programs")
      .insert({
        goal,
        name: template.name,
        description: template.description,
        structure: template.structure,
        is_template: false,
        client_id: userId,
      })
      .select("id")
      .single();
    programId = instance?.id ?? null;
  }

  await admin
    .from("profiles")
    .update({ full_name: fullName, goal, program_id: programId })
    .eq("id", userId);

  // Establish the real browser session (sets the auth cookies on this response).
  const supabase = createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) {
    return NextResponse.json({ error: "Account created — please sign in." }, { status: 200 });
  }

  if (tier === "free") {
    // Free is real immediately (no payment step), so the welcome email goes out now.
    // Paid tiers stay on tier=free until Stripe confirms — their welcome email fires
    // from the checkout.session.completed webhook handler instead.
    await sendWelcomeEmailOnce(admin, { id: userId, email, full_name: fullName, tier: "free" });
    return NextResponse.json({ ok: true, checkoutUrl: null });
  }

  const priceId = TIER_PRICE_IDS[tier];
  if (!priceId) {
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { profile_id: userId, tier },
    subscription_data: { metadata: { profile_id: userId, tier } },
    success_url: `${siteUrl}/onboarding?checkout=success`,
    cancel_url: `${siteUrl}/pricing?checkout=cancelled`,
  });

  return NextResponse.json({ ok: true, checkoutUrl: session.url });
}
