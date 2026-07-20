import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Goal } from "@/lib/types";

const GOALS: Goal[] = ["strength_gain", "fat_loss", "hybrid", "powerlifting"];

/** Client onboarding: profile info + initial measurements + goal -> auto-assign program. */
export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const { fullName, birthday, heightIn, startingWeight, goal, measurements } = body;
  if (!GOALS.includes(goal)) {
    return NextResponse.json({ error: "Invalid goal." }, { status: 400 });
  }

  // Find the shared template for this goal, then copy it into a client-owned instance
  // so Jon can later customize this client's program without touching the shared template.
  const admin = supabaseAdmin();
  const { data: template, error: templateErr } = await admin
    .from("programs")
    .select("*")
    .eq("goal", goal)
    .eq("is_template", true)
    .maybeSingle();

  if (templateErr || !template) {
    return NextResponse.json({ error: "No template found for that goal." }, { status: 500 });
  }

  const { data: instance, error: instanceErr } = await client
    .from("programs")
    .insert({
      goal,
      name: template.name,
      description: template.description,
      structure: template.structure,
      is_template: false,
      client_id: session.id,
    })
    .select()
    .single();

  if (instanceErr || !instance) {
    return NextResponse.json({ error: instanceErr?.message ?? "Could not assign program." }, { status: 500 });
  }

  const { error: profileErr } = await client
    .from("profiles")
    .update({
      full_name: fullName ?? null,
      birthday: birthday ?? null,
      height_in: heightIn ?? null,
      starting_weight: startingWeight ?? null,
      current_weight: startingWeight ?? null,
      goal,
      program_id: instance.id,
      onboarded: true,
    })
    .eq("id", session.id);

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  if (measurements) {
    await client.from("measurements").insert({
      profile_id: session.id,
      weight: startingWeight ?? null,
      waist: measurements.waist ?? null,
      chest: measurements.chest ?? null,
      hips: measurements.hips ?? null,
      arms: measurements.arms ?? null,
      thighs: measurements.thighs ?? null,
      notes: "Initial check-in",
    });
  }

  return NextResponse.json({ ok: true, programId: instance.id });
}

export async function PATCH(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const allowed = ["full_name", "birthday", "height_in", "current_weight"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { error } = await client.from("profiles").update(updates).eq("id", session.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
