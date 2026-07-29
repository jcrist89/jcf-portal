import { NextRequest, NextResponse } from "next/server";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendPushToProfile } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Daily cron (see vercel.json): pushes an inactivity nudge to clients who've
 * crossed the 7- or 14-day quiet mark, once per threshold crossing. Mirrors
 * the in-app dashboard banner's thresholds, just delivered as a push instead
 * of waiting for the client to open the app. */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: clients } = await admin
    .from("profiles")
    .select("id, created_at, last_nudge_threshold")
    .eq("role", "client")
    .eq("is_active", true);

  let sent = 0;
  for (const p of clients ?? []) {
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
  }

  return NextResponse.json({ checked: clients?.length ?? 0, sent });
}
