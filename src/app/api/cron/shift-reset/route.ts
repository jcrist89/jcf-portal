import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { logEvent } from "@/lib/eventLog";
import {
  SHIFT_RESET_CAP,
  SHIFT_RESET_OFFER_CODE,
  SHIFT_RESET_PAYMENT_LINK_ID,
  dateInNewYork,
  shiftResetEnrollmentOpen,
} from "@/lib/shiftReset";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { count, error: countError } = await admin
    .from("jcf_checkout_purchases")
    .select("checkout_session_id", { count: "exact", head: true })
    .eq("offer_code", SHIFT_RESET_OFFER_CODE)
    .eq("payment_status", "paid");

  if (countError) {
    await logEvent(admin, {
      level: "error",
      source: "cron.shift_reset",
      message: "Could not count Shift Reset enrollments",
      context: { error: countError.message },
    });
    return NextResponse.json({ error: "Could not count enrollments." }, { status: 500 });
  }

  const paidCount = count ?? 0;
  const shouldBeActive = shiftResetEnrollmentOpen(paidCount);
  const stripe = getStripe();

  try {
    const link = await stripe.paymentLinks.retrieve(SHIFT_RESET_PAYMENT_LINK_ID);
    if (link.active !== shouldBeActive) {
      await stripe.paymentLinks.update(SHIFT_RESET_PAYMENT_LINK_ID, {
        active: shouldBeActive,
      });
      await logEvent(admin, {
        level: "info",
        source: "cron.shift_reset",
        message: shouldBeActive
          ? "Shift Reset enrollment opened automatically"
          : "Shift Reset enrollment closed automatically",
        context: {
          paidCount,
          cap: SHIFT_RESET_CAP,
          localDate: dateInNewYork(),
        },
      });
    }

    return NextResponse.json({
      localDate: dateInNewYork(),
      paidCount,
      cap: SHIFT_RESET_CAP,
      active: shouldBeActive,
      changed: link.active !== shouldBeActive,
    });
  } catch (error) {
    await logEvent(admin, {
      level: "error",
      source: "cron.shift_reset",
      message: "Could not synchronize Shift Reset Stripe enrollment state",
      context: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: "Could not synchronize enrollment." }, { status: 500 });
  }
}
