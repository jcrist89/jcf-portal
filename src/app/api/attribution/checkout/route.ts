import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { logEvent } from "@/lib/eventLog";
import {
  ATTR_FIRST_COOKIE,
  ATTR_LAST_COOKIE,
  ATTR_VISITOR_COOKIE,
  decodeTouch,
  touchDbFields,
} from "@/lib/attribution";

const AFTER_CHECKOUT =
  "https://xdztfuocalvpdmmvsxaw.supabase.co/functions/v1/jcf-after-checkout";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session") ?? "";
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.redirect(new URL("/pricing?checkout=invalid", request.url));
  }

  const admin = supabaseAdmin();

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const offerCode = session.metadata?.offer_code ?? null;
    const visitorId = request.cookies.get(ATTR_VISITOR_COOKIE)?.value ?? null;
    const first = decodeTouch(request.cookies.get(ATTR_FIRST_COOKIE)?.value);
    const last = decodeTouch(request.cookies.get(ATTR_LAST_COOKIE)?.value);

    const { error: attributionError } = await admin
      .from("jcf_checkout_attribution")
      .upsert(
        {
          checkout_session_id: sessionId,
          visitor_id:
            visitorId && /^[0-9a-f-]{36}$/i.test(visitorId)
              ? visitorId
              : null,
          offer_code: offerCode,
          ...touchDbFields("first", first),
          ...touchDbFields("last", last),
          attributed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "checkout_session_id" },
      );

    if (attributionError) {
      await logEvent(admin, {
        level: "warning",
        source: "attribution.checkout",
        message: "Checkout completed but attribution could not be persisted",
        context: { sessionId, error: attributionError.message },
      });
    } else if (visitorId && /^[0-9a-f-]{36}$/i.test(visitorId)) {
      await admin.from("jcf_attribution_events").insert({
        visitor_id: visitorId,
        event_type: "checkout_return",
        offer_code: offerCode,
        source: last?.source ?? null,
        medium: last?.medium ?? null,
        campaign: last?.campaign ?? null,
        content_id: last?.contentId ?? null,
        term: last?.term ?? null,
        landing_path: last?.landingPath ?? null,
        referrer: last?.referrer ?? null,
      });
    }

    // If this buyer already entered the sales pipeline, close that loop
    // automatically. Prefer the first-party visitor id; fall back to checkout
    // email for DM/manual leads that were logged before a tracked link existed.
    if (offerCode) {
      const validVisitor =
        visitorId && /^[0-9a-f-]{36}$/i.test(visitorId) ? visitorId : null;
      const checkoutEmail = String(
        session.customer_details?.email ?? session.customer_email ?? "",
      ).trim().toLowerCase();

      let matchedLead: any = null;
      if (validVisitor) {
        const { data } = await admin
          .from("jcf_leads")
          .select("*")
          .eq("visitor_id", validVisitor)
          .not("status", "in", "(won,lost)")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        matchedLead = data;
      }

      if (!matchedLead && checkoutEmail) {
        const { data } = await admin
          .from("jcf_leads")
          .select("*")
          .ilike("email", checkoutEmail)
          .not("status", "in", "(won,lost)")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        matchedLead = data;
      }

      if (matchedLead) {
        const { data: offer } = await admin
          .from("offers")
          .select("amount_cents,installments")
          .eq("code", offerCode)
          .maybeSingle();

        const contracted = offer
          ? Number(offer.amount_cents) * Math.max(1, Number(offer.installments ?? 1))
          : Number(session.amount_total ?? 0);
        const now = new Date().toISOString();

        const { error: leadError } = await admin
          .from("jcf_leads")
          .update({
            status: "won",
            offer_code: offerCode,
            contracted_value_cents: contracted,
            purchase_session_id: sessionId,
            qualified_at: matchedLead.qualified_at ?? now,
            won_at: matchedLead.won_at ?? now,
            lost_at: null,
            lost_reason: null,
            next_action: null,
            next_action_due: null,
            updated_at: now,
          })
          .eq("id", matchedLead.id);

        if (leadError) {
          await logEvent(admin, {
            level: "warning",
            source: "lead.checkout_match",
            message: "Paid checkout could not update the matched lead",
            context: { leadId: matchedLead.id, sessionId, error: leadError.message },
          });
        } else {
          await admin.from("jcf_lead_events").insert({
            lead_id: matchedLead.id,
            event_type: "checkout_matched",
            from_status: matchedLead.status,
            to_status: "won",
            note: `Automatically matched paid ${offerCode} checkout.`,
          });
        }
      }
    }
  } catch (error) {
    await logEvent(admin, {
      level: "warning",
      source: "attribution.checkout",
      message: "Attribution bridge failed; onboarding redirect preserved",
      context: {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  // Attribution is observational. It must never prevent a paid buyer from
  // reaching the onboarding workflow.
  const target = new URL(AFTER_CHECKOUT);
  target.searchParams.set("session", sessionId);
  return NextResponse.redirect(target);
}
