import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { runAchievementChecks } from "@/lib/achievements";
import type { Profile } from "@/lib/types";

export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const profileId = session.role === "coach" && body.profileId ? body.profileId : session.id;

  const { data: log, error } = await client
    .from("workout_logs")
    .insert({
      profile_id: profileId,
      program_id: body.programId ?? null,
      date: body.date ?? new Date().toISOString().slice(0, 10),
      day_label: body.dayLabel ?? null,
      exercises_completed: body.exercisesCompleted ?? [],
      completed: body.completed ?? true,
    })
    .select()
    .single();

  if (error || !log) {
    return NextResponse.json({ error: error?.message ?? "Could not save workout." }, { status: 500 });
  }

  const newAchievements = await checkAndAwardAchievements(client, profileId);

  return NextResponse.json({ workoutLog: log, newAchievements });
}

export async function checkAndAwardAchievements(
  client: any,
  profileId: string,
  opts: { newPr?: any } = {}
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
