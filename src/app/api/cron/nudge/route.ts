import { NextRequest, NextResponse } from "next/server";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendPushToProfile } from "@/lib/push";
import { logEvent } from "@/lib/eventLog";

export const dynamic = "force-dynamic";

/** Daily cron (see vercel.json): pushes an inactivity nudge to clients who've
 * crossed the 7- or 14-day quiet mark, once per threshold crossing. Mirrors
 * the in-app dashboard banner's thresholds, just delivered as a push instead
 * of waiting for the client to open the app. Also runs a lightweight billing
 * health check (see checkTierMismatches below) in the same daily pass rather
 * than adding a second scheduled job. */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();

  let clients: Array<{ id: string; created_at: string; last_nudge_threshold: number | null }> = [];
  try {
    const { data, error } = await admin
      .from("profiles")
      .select("id, created_at, last_nudge_threshold")
      .eq("role", "client")
      .eq("is_active", true);
    if (error) throw error;
    clients = data ?? [];
  } catch (err) {
    await logEvent(admin, {
      level: "error",
      source: "cron.nudge",
      message: "Failed to load active clients",
      context: { error: (err as Error)?.message },
    });
    return NextResponse.json({ error: "Failed to load clients." }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  for (const p of clients) {
    try {
      const [{ data: logs }, { data: measurements }, { data: prs }] = await Promise.all([
        admin.from("workout_logs").select("date").eq("profile_id", p.id).eq("completed", true),
        admin.from("measurements").select("date").eq("profile_id", p.id),
        admin.from("prs").select("date").eq("profile_id", p.id),
      ]);
      const dates = [
        ...(logs ?? []).map((l: any) => l.date),
        ...(measurements ?? []).map((m: any) => m.date),
        ...(prs ?? []).map((r: any) => r.date),
      ].sort();
      const lastActivity = dates.length ? dates[dates.length - 1] : p.created_at;
      const days = differenceInCalendarDays(new Date(), parseISO(lastActivity));

      const threshold = days >= 14 ? 14 : days >= 7 ? 7 : 0;

      if (threshold > 0 && threshold !== p.last_nudge_threshold) {
        await sendPushToProfile(p.id, {
          title: threshold >= 14 ? "We miss you" : "Keep it going",
          body:
            threshold >= 14
              ? "It's been two weeks since your last log. Let's get back on track today."
              : "It's been a week since your last log — your streak's at risk.",
          url: "/dashboard",
        });
        await admin.from("profiles").update({ last_nudge_threshold: threshold }).eq("id", p.id);
        sent += 1;
      } else if (threshold === 0 && p.last_nudge_threshold) {
        await admin.from("profiles").update({ last_nudge_threshold: null }).eq("id", p.id);
      }
    } catch (err) {
      failed += 1;
      // One client's failure shouldn't abort the rest of the run.
      await logEvent(admin, {
        level: "error",
        source: "cron.nudge",
        message: "Failed to process inactivity nudge for a client",
        context: { error: (err as Error)?.message },
        profileId: p.id,
      });
    }
  }

  const mismatches = await checkTierMismatches(admin);
  const missedSessions = await markMissedSessions(admin);

  return NextResponse.json({
    checked: clients.length,
    sent,
    failed,
    tierMismatches: mismatches,
    missedSessions,
  });
}

/**
 * Cheap, no-external-API-call heuristic for "paid subscription showing the
 * wrong tier": flags profiles whose subscription_status/tier combination is
 * internally inconsistent (e.g. a paid tier with a canceled/past_due
 * subscription, or an "active" status with no Stripe subscription id at all —
 * both indicate the webhook missed a sync). Doesn't call the Stripe API (no
 * added cost/rate-limit exposure) — just flags what the DB's own data already
 * shows as suspicious, for the coach to double-check.
 */
async function checkTierMismatches(admin: ReturnType<typeof supabaseAdmin>): Promise<number> {
  const { data: suspects } = await admin
    .from("profiles")
    .select("id, tier, subscription_status, stripe_subscription_id, stripe_customer_id")
    .neq("tier", "free");

  // The previous version required stripe_customer_id to be non-null before testing
  // anything, on the theory that comped clients would otherwise look mismatched. That
  // filter also swallowed the one condition that is never legitimate: a profile
  // claiming subscription_status 'active' with no Stripe customer behind it at all.
  // Every live paid-tier row in the database was exactly that shape, so the check was
  // structurally incapable of firing. Comped clients are excluded by the status they
  // actually carry ('n/a'), not by the absence of a customer id.
  const mismatches = (suspects ?? []).filter((p: any) => {
    if (p.subscription_status === "n/a") return false; // comped / manually arranged
    if (p.subscription_status === "active" && (!p.stripe_customer_id || !p.stripe_subscription_id)) {
      return true; // claims an active subscription that Stripe has no record of
    }
    return p.subscription_status === "canceled" || p.subscription_status === "past_due";
  });

  for (const p of mismatches) {
    await logEvent(admin, {
      level: "warning",
      source: "cron.tier_mismatch",
      message: "Paid tier with an inconsistent subscription status",
      context: { tier: p.tier, subscriptionStatus: p.subscription_status },
      profileId: p.id,
    });
  }

  return mismatches.length;
}

/**
 * Drops sessions a date-anchored block has run past, in each client's own timezone.
 * Without a daily sweep the prescribed/skipped split is a snapshot that goes stale
 * overnight, and a peaking block starts queuing work it can no longer fit before the
 * meet. Sequential assignments are untouched — there a missed session waits.
 */
async function markMissedSessions(admin: ReturnType<typeof supabaseAdmin>): Promise<number> {
  const { data, error } = await admin.rpc("mark_missed_sessions");
  if (error) {
    await logEvent(admin, {
      level: "error",
      source: "cron.missed_sessions",
      message: "Failed to sweep missed sessions",
      context: { error: error.message },
    });
    return 0;
  }
  return typeof data === "number" ? data : 0;
}
