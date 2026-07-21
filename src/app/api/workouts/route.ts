import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { runAchievementChecks } from "@/lib/achievements";
import { detectNewPRs } from "@/lib/workoutHistory";
import { adjustTrainingMax } from "@/lib/trainingMax";
import type { Profile, WorkoutLog } from "@/lib/types";

export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const profileId = session.role === "coach" && body.profileId ? body.profileId : session.id;
  const exercisesCompleted = body.exercisesCompleted ?? [];

  const { data: priorLogs } = await client
    .from("workout_logs")
    .select("*")
    .eq("profile_id", profileId);

  const { data: log, error } = await client
    .from("workout_logs")
    .insert({
      profile_id: profileId,
      program_id: body.programId ?? null,
      date: body.date ?? new Date().toISOString().slice(0, 10),
      day_label: body.dayLabel ?? null,
      exercises_completed: exercisesCompleted,
      completed: body.completed ?? true,
    })
    .select()
    .single();

  if (error || !log) {
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

  const newAchievements = await checkAndAwardAchievements(client, profileId, { newPrs });

  return NextResponse.json({ workoutLog: log, newPrs, newAchievements });
}

export async function checkAndAwardAchievements(
  client: any,
  profileId: string,
  opts: { newPr?: any; newPrs?: any[] } = {}
) {
  const [{ data: profile }, { data: existing }, { data: workoutLogs }, { data: measurements }, { data: prs }] =
    await Promise.all([
      client.from("profiles").select("*").eq("id", profileId).maybeSingle(),
      client.from("achievements").select("*").eq("profile_id", profileId),
      client.from("workout_logs").select("*").eq("profile_id", profileId),
      client.from("measurements").select("*").eq("profile_id", profileId),
      client.from("prs").select("*").eq("profile_id", profileId),
    ]);

  if (!profile) return [];

  const newOnes = runAchievementChecks(
    {
      profile: profile as Profile,
      existing: existing ?? [],
      workoutLogs: workoutLogs ?? [],
      measurements: measurements ?? [],
      prs: prs ?? [],
    },
    opts
  );

  if (newOnes.length === 0) return [];

  const { data: inserted } = await client
    .from("achievements")
    .insert(
      newOnes.map((a) => ({
        profile_id: profileId,
        type: a.type,
        title: a.title,
        description: a.description,
        icon: a.icon,
      }))
    )
    .select();

  return inserted ?? [];
}
