import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { calculateTrainingMax } from "@/lib/trainingMax";
import { requireExistingClient } from "@/lib/auth/authorize";

// Coach-only. Upserts a training_maxes row by (profile_id, lift) — used for the
// meet-prep TM track (lift: "meet_bench" | "meet_deadlift"), where a row may not
// exist yet, unlike the existing hit/miss UPDATE-only path in /api/workouts.
export async function PATCH(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx || ctx.session.role !== "coach") {
    return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.profileId || !body?.lift || typeof body.oneRm !== "number") {
    return NextResponse.json({ error: "profileId, lift, and oneRm are required." }, { status: 400 });
  }

  // body.profileId is fully caller-controlled and this route writes via the
  // service-role client (bypasses RLS) — confirm it actually targets a client
  // profile before upserting against it.
  const admin = supabaseAdmin();
  const targetCheck = await requireExistingClient(admin, body.profileId);
  if (targetCheck) return targetCheck;

  const unit: "kg" | "lb" = body.unit === "kg" ? "kg" : "lb";
  const tmPercent: number = typeof body.tmPercent === "number" ? body.tmPercent : 90;
  const increment = unit === "kg" ? 2.5 : 5;
  const calculatedTm = calculateTrainingMax(body.oneRm, tmPercent, increment);
  const approvedTm: number = typeof body.approvedTm === "number" ? body.approvedTm : calculatedTm;

  const { data: trainingMax, error } = await admin
    .from("training_maxes")
    .upsert(
      {
        profile_id: body.profileId,
        lift: body.lift,
        weight: approvedTm,
        one_rm: body.oneRm,
        unit,
        tm_percent: tmPercent,
        updated_by: ctx.session.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,lift" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trainingMax });
}
