import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { detectNewPRs } from "@/lib/workoutHistory";
import { checkAndAwardAchievements } from "@/lib/awardAchievements";
import { adjustTrainingMax } from "@/lib/trainingMax";
import { notifyDeviationReported } from "@/lib/push";
import { resolveProfileId, timezoneFor } from "@/lib/auth/authorize";
import { resolveLocalDate } from "@/lib/localDate";
import { logEvent } from "@/lib/eventLog";
import { completeScheduledSession } from "@/server/schedule";
import type { WorkoutLog } from "@/lib/types";

export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client } = ctx;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const profileId = resolveProfileId(ctx, body.profileId);
  const exercisesCompleted = body.exercisesCompleted ?? [];
  // The client's training day. A session finished at 01:30 in Toronto belongs to the
  // day the client just trained, not to the UTC date that's already rolled over.
  const workoutDate = resolveLocalDate(body.date, await timezoneFor(ctx, profileId));

  const { data: priorLogs } = await client
    .from("workout_logs")
    .select("*")
    .eq("profile_id", profileId);

  const { data: log, error } = await client
    .from("workout_logs")
    .insert({
      profile_id: profileId,
      program_id: body.programId ?? null,
      date: workoutDate,
      day_label: body.dayLabel ?? null,
      exercises_completed: exercisesCompleted,
      completed: body.completed ?? true,
    })
    .select()
    .single();

  if (error || !log) {
    await logEvent(supabaseAdmin(), {
      level: "error",
      source: "workouts.save",
      message: "Failed to save a workout log",
      context: { error: error?.message ?? "no row returned" },
      profileId,
    });
    return NextResponse.json({ error: error?.message ?? "Could not save workout." }, { status: 500 });
  }

  const prCandidates = body.completed === false ? [] : detectNewPRs((priorLogs ?? []) as WorkoutLog[], exercisesCompleted);
  let newPrs: any[] = [];
  if (prCandidates.length > 0) {
    const { data: inserted } = await client
      .from("prs")
      .insert(
        prCandidates.map((c) => ({
          profile_id: profileId,
          lift: c.lift,
          weight: c.weight,
          unit: c.unit,
          reps: c.reps,
          date: log.date,
          notes: "Auto-detected from workout log",
        }))
      )
      .select();
    newPrs = inserted ?? [];
  }

  // Training-max auto-adjustment: client sends which lifts were TM-driven this
  // session and whether they were hit or missed; we bump/hold the training max.
  const trainingMaxAdjustments = Array.isArray(body.trainingMaxAdjustments) ? body.trainingMaxAdjustments : [];
  if (trainingMaxAdjustments.length > 0) {
    const { data: currentTMs } = await client
      .from("training_maxes")
      .select("*")
      .eq("profile_id", profileId)
      .in("lift", trainingMaxAdjustments.map((a: any) => a.lift));
    const tmMap = new Map((currentTMs ?? []).map((t: any) => [t.lift, Number(t.weight)]));
    for (const adj of trainingMaxAdjustments) {
      const current = tmMap.get(adj.lift);
      if (current == null) continue;
      const next = adjustTrainingMax(current, !!adj.hit);
      if (next !== current) {
        await client
          .from("training_maxes")
          .update({ weight: next, updated_at: new Date().toISOString() })
          .eq("profile_id", profileId)
          .eq("lift", adj.lift);
      }
    }
  }

  // Deviation reports: exercises logged above the prescribed limit without an
  // approved joker set (flagged client-side, captured here for coach review).
  const deviationReports = Array.isArray(body.deviationReports) ? body.deviationReports : [];
  if (deviationReports.length > 0) {
    await client.from("deviation_reports").insert(
      deviationReports.map((d: any) => ({
        profile_id: profileId,
        workout_log_id: log.id,
        exercise_name: d.exerciseName,
        lift_key: d.liftKey ?? null,
        week_number: d.weekNumber ?? null,
        prescribed_weight: d.prescribedWeight ?? null,
        actual_weight: d.actualWeight,
        reason: d.reason ?? null,
        actual_rpe: d.actualRpe ?? null,
        pain_score: d.painScore ?? null,
        technical_rating: d.technicalRating ?? null,
      })),
    );
    await notifyDeviationReported(profileId);
  }

  // Close the scheduled session this log satisfies. Guarded by profile id inside, so a
  // caller cannot close somebody else's session by guessing an id.
  if (typeof body.assignmentSessionId === "string" && body.completed !== false) {
    await completeScheduledSession(supabaseAdmin(), {
      sessionId: body.assignmentSessionId,
      profileId,
      workoutLogId: log.id,
      completedOn: workoutDate,
      scalingMode: typeof body.scalingMode === "string" ? body.scalingMode : null,
      scalingReason: typeof body.scalingReason === "string" ? body.scalingReason : null,
    });
  }

  const newAchievements = await checkAndAwardAchievements(client, profileId, { newPrs });

  return NextResponse.json({ workoutLog: log, newPrs, newAchievements });
}
