import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { checkAndAwardAchievements } from "@/app/api/workouts/route";

export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;

  const body = await req.json().catch(() => null);
  if (!body?.lift || !body?.weight) {
    return NextResponse.json({ error: "Lift and weight are required." }, { status: 400 });
  }

  const profileId = session.role === "coach" && body.profileId ? body.profileId : session.id;

  const { data: pr, error } = await client
    .from("prs")
    .insert({
      profile_id: profileId,
      lift: body.lift,
      weight: body.weight,
      reps: body.reps ?? 1,
      date: body.date ?? new Date().toISOString().slice(0, 10),
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error || !pr) {
    return NextResponse.json({ error: error?.message ?? "Could not save PR." }, { status: 500 });
  }

  const newAchievements = await checkAndAwardAchievements(client, profileId, { newPr: pr });
  return NextResponse.json({ pr, newAchievements });
}
