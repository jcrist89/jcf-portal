import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { checkJokerEligibility, jokerMaxPermittedWeight } from "@/lib/meetPrep/jokerEligibility";
import { computeWeeklyCompliance } from "@/lib/meetPrep/compliance";
import { notifyJokerRequested } from "@/lib/push";
import type { DeviationReport, Program, ReadinessCheckin, WorkoutLog } from "@/lib/types";

export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;

  const body = await req.json().catch(() => null);
  if (!body?.lift || typeof body.weekNumber !== "number" || typeof body.topSingleWeight !== "number" || typeof body.topSingleRpe !== "number") {
    return NextResponse.json({ error: "lift, weekNumber, topSingleWeight, and topSingleRpe are required." }, { status: 400 });
  }
  if (body.lift !== "meet_bench" && body.lift !== "meet_deadlift") {
    return NextResponse.json({ error: "Joker sets are only available on the meet lifts." }, { status: 400 });
  }

  const profileId = session.role === "coach" && body.profileId ? body.profileId : session.id;
  const today = new Date().toISOString().slice(0, 10);

  const { data: profile } = await client.from("profiles").select("program_id").eq("id", profileId).maybeSingle();

  const [{ data: program }, { data: logs }, { data: deviations }, { data: readiness }] = await Promise.all([
    profile?.program_id
      ? client.from("programs").select("*").eq("id", profile.program_id).maybeSingle()
      : Promise.resolve({ data: null }),
    client.from("workout_logs").select("*").eq("profile_id", profileId),
    client.from("deviation_reports").select("*").eq("profile_id", profileId),
    client.from("readiness_checkins").select("*").eq("profile_id", profileId),
  ]);

  const readinessRows = (readiness ?? []) as ReadinessCheckin[];
  const todayReadiness = readinessRows.find((r) => r.date === today);
  const unresolvedThisWeek = ((deviations ?? []) as DeviationReport[]).filter(
    (d) => d.week_number === body.weekNumber && !d.reviewed,
  ).length;

  const priorWeekCompliance =
    body.weekNumber > 1
      ? computeWeeklyCompliance({
          program: program as Program | null,
          logs: (logs ?? []) as WorkoutLog[],
          deviations: (deviations ?? []) as DeviationReport[],
          readiness: readinessRows,
          week: body.weekNumber - 1,
        }).score
      : null;

  const { eligible, reasons } = checkJokerEligibility({
    week: body.weekNumber,
    topSingleRpe: body.topSingleRpe,
    readinessTier: todayReadiness?.tier ?? null,
    priorWeekCompliance,
    unresolvedDeviationsThisWeek: unresolvedThisWeek,
  });

  if (!eligible) {
    return NextResponse.json({ error: "Not eligible for a joker set.", reasons }, { status: 400 });
  }

  const maxPermittedWeight = jokerMaxPermittedWeight(body.topSingleWeight, 2.5);

  const { data: jokerRequest, error } = await client
    .from("joker_requests")
    .insert({
      profile_id: profileId,
      program_id: profile?.program_id ?? null,
      week_number: body.weekNumber,
      lift: body.lift,
      top_single_weight: body.topSingleWeight,
      top_single_rpe: body.topSingleRpe,
      max_permitted_weight: maxPermittedWeight,
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await notifyJokerRequested(profileId);
  return NextResponse.json({ jokerRequest }, { status: 201 });
}
