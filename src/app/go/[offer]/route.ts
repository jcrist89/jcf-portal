import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  SHIFT_RESET_CAP,
  SHIFT_RESET_OFFER_CODE,
  shiftResetEnrollmentOpen,
} from "@/lib/shiftReset";
import { checkoutOffer } from "@/lib/checkoutOffers";
import {
  legalRequirementsForOffer,
  missingLegalAcceptances,
} from "@/server/legalRequirements";
import {
  ATTR_FIRST_COOKIE,
  ATTR_LAST_COOKIE,
  ATTR_VISITOR_COOKIE,
  ATTR_COOKIE_MAX_AGE,
  decodeTouch,
  defaultOnsiteTouch,
  encodeTouch,
} from "@/lib/attribution";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: true,
    path: "/",
    maxAge: ATTR_COOKIE_MAX_AGE,
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ offer: string }> },
) {
  const { offer } = await context.params;
  const config = checkoutOffer(offer);
  if (!config) return NextResponse.redirect(new URL("/pricing", request.url));

  const admin = supabaseAdmin();
  if (config.offerCode === SHIFT_RESET_OFFER_CODE) {
    const { count } = await admin
      .from("jcf_checkout_purchases")
      .select("checkout_session_id", { count: "exact", head: true })
      .eq("offer_code", SHIFT_RESET_OFFER_CODE)
      .eq("payment_status", "paid");
    const paidCount = count ?? 0;
    if (!shiftResetEnrollmentOpen(paidCount)) {
      const target = new URL("/pricing", request.url);
      target.searchParams.set("reset", paidCount >= SHIFT_RESET_CAP ? "full" : "closed");
      return NextResponse.redirect(target);
    }
  }

  const existingVisitor = request.cookies.get(ATTR_VISITOR_COOKIE)?.value ?? null;
  const validExistingVisitor =
    existingVisitor != null && /^[0-9a-f-]{36}$/i.test(existingVisitor);
  const visitorId = validExistingVisitor ? existingVisitor : crypto.randomUUID();
  const createdVisitor = !validExistingVisitor;

  let first = decodeTouch(request.cookies.get(ATTR_FIRST_COOKIE)?.value);
  let last = decodeTouch(request.cookies.get(ATTR_LAST_COOKIE)?.value);

  // A buyer who arrived without campaign tags is still attributable. Treat the
  // pricing/site CTA as the source rather than writing an empty acquisition row.
  const fallback = defaultOnsiteTouch(request.headers.get("referer") ? "/pricing" : request.nextUrl.pathname, offer);
  if (!first) first = last ?? fallback;
  if (!last) last = first ?? fallback;

  const options = cookieOptions();
  const withTrackingCookies = (response: NextResponse) => {
    if (createdVisitor) response.cookies.set(ATTR_VISITOR_COOKIE, visitorId, options);
    if (!request.cookies.get(ATTR_FIRST_COOKIE)?.value) {
      response.cookies.set(ATTR_FIRST_COOKIE, encodeTouch(first!), options);
    }
    if (!request.cookies.get(ATTR_LAST_COOKIE)?.value) {
      response.cookies.set(ATTR_LAST_COOKIE, encodeTouch(last!), options);
    }
    return response;
  };

  // Legal requirements are data-driven and currently disabled until reviewed
  // documents are activated. Once enabled, checkout fails closed if an active
  // version is missing and otherwise requires acceptance of that exact version.
  const legal = await legalRequirementsForOffer(admin, config.offerCode, "pre_checkout");
  if (legal.misconfigured) {
    const target = new URL("/pricing", request.url);
    target.searchParams.set("legal", "unavailable");
    return withTrackingCookies(NextResponse.redirect(target));
  }
  if (legal.requirements.length > 0) {
    const missing = await missingLegalAcceptances(admin, visitorId, legal.requirements);
    if (missing.length > 0) {
      const target = new URL("/agreement", request.url);
      target.searchParams.set("offer", offer);
      return withTrackingCookies(NextResponse.redirect(target));
    }
  }

  const { error } = await admin.from("jcf_attribution_events").insert({
    visitor_id: visitorId,
    event_type: "checkout_click",
    offer_code: config.offerCode,
    source: last.source,
    medium: last.medium,
    campaign: last.campaign,
    content_id: last.contentId,
    term: last.term,
    landing_path: last.landingPath,
    referrer: last.referrer,
  });

  // Attribution must never become a payment outage. If analytics fails, the
  // customer still gets to checkout.
  if (error) {
    console.error("attribution checkout_click", error.message);
  }

  return withTrackingCookies(NextResponse.redirect(config.destination));
}
