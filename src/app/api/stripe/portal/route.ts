import { NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;

  const { data: profile } = await client
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", session.id)
    .maybeSingle();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account on file yet." }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const stripe = getStripe();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${siteUrl}/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
