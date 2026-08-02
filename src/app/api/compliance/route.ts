import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { computeWeeklyCompliance } from "@/lib/meetPrep/compliance";
import type { DeviationReport, Program, ReadinessCheckin, WorkoutLog } from "@/lib/types";

export async function GET(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;

  const url = new URL(req.url);
  const profileId = url.searchParams.get("profileId") ?? session.id;
  if (profileId !== session.id && session.role !== "coach") {
    return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  }
  const totalWeeks = Math.min(Number(url.searchParams.get("weeks") ?? 13) || 13, 13);

  const { data: profile } = await client.from("profiles").select("program_id").eq("id", profileId).maybeSingle();

  const [{ data: program }, { data: logs }, { data: deviations }, { data: readiness }] = await Promise.all([
    profile?.program_id
      ? client.from("programs").select("*").eq("id", profile.program_id).maybeSingle()
      : Promise.resolve({ data: null }),
    client.from("workout_logs").select("*").eq("profile_id", profileId),
    client.from("deviation_reports").select("*").eq("profile_id", profileId),
    client.from("readiness_checkins").select("*").eq("profile_id", profileId),
  ]);

  const weeks = Array.from({ length: totalWeeks }, (_, i) =>
    computeWeeklyCompliance({
      program: program as Program | null,
      logs: (logs ?? []) as WorkoutLog[],
      deviations: (deviations ?? []) as DeviationReport[],
      readiness: (readiness ?? []) as ReadinessCheckin[],
      week: i + 1,
    }),
  );

  return NextResponse.json({ weeks });
}
