import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { checkAndAwardAchievements } from "@/app/api/workouts/route";

export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const profileId = session.role === "coach" && body.profileId ? body.profileId : session.id;

  const { data: measurement, error } = await client
    .from("measurements")
    .insert({
      profile_id: profileId,
      date: body.date ?? new Date().toISOString().slice(0, 10),
      weight: body.weight ?? null,
      waist: body.waist ?? null,
      chest: body.chest ?? null,
      hips: body.hips ?? null,
      arms: body.arms ?? null,
      thighs: body.thighs ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error || !measurement) {
    return NextResponse.json({ error: error?.message ?? "Could not save measurement." }, { status: 500 });
  }

  if (body.weight) {
    await client.from("profiles").update({ current_weight: body.weight }).eq("id", profileId);
  }

  const newAchievements = await checkAndAwardAchievements(client, profileId);
  return NextResponse.json({ measurement, newAchievements });
}
