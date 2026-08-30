import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireExistingClient } from "@/lib/auth/authorize";

/** How long "Snooze" hides a signal for. Short on purpose — a snooze is "not today",
 *  not "never", and a long one is indistinguishable from ignoring the problem. */
const SNOOZE_DAYS = 3;

/**
 * Records what the coach decided about a signal.
 *
 * Signals themselves are derived on read, so nothing here creates or edits one — this
 * only stores the decision, keyed to the signal's fingerprint. When the underlying
 * condition worsens the fingerprint changes, no suppression matches, and the signal
 * comes back on its own. That is what stops "Done" from permanently silencing a client
 * who is getting worse.
 */
export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx || ctx.session.role !== "coach") {
    return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const profileId = String(body?.profileId ?? "");
  const signalKind = String(body?.signalKind ?? "");
  const fingerprint = String(body?.fingerprint ?? "");
  const action = body?.action === "snoozed" ? "snoozed" : body?.action === "resolved" ? "resolved" : null;

  if (!profileId || !signalKind || !fingerprint || !action) {
    return NextResponse.json(
      { error: "profileId, signalKind, fingerprint and action are required." },
      { status: 400 },
    );
  }

  const admin = supabaseAdmin();
  const targetCheck = await requireExistingClient(admin, profileId);
  if (targetCheck) return targetCheck;

  let snoozedUntil: string | null = null;
  if (action === "snoozed") {
    const until = new Date();
    until.setUTCDate(until.getUTCDate() + SNOOZE_DAYS);
    snoozedUntil = until.toISOString().slice(0, 10);
  }

  const { data, error } = await admin
    .from("coach_signal_actions")
    .upsert(
      {
        profile_id: profileId,
        signal_kind: signalKind,
        fingerprint,
        action,
        snoozed_until: snoozedUntil,
        acted_at: new Date().toISOString(),
        acted_by: ctx.session.id,
      },
      { onConflict: "profile_id,signal_kind,fingerprint" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ signalAction: data });
}
