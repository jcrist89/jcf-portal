import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Goal } from "@/lib/types";

const GOALS: Goal[] = ["strength_gain", "fat_loss", "hybrid", "powerlifting"];

/** Client onboarding: profile info + initial measurements, plus goal -> auto-assign
 * program for clients who don't already have one set (public signup assigns goal +
 * program immediately, so onboarding only fills in the rest for that path). */
export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const { fullName, birthday, heightIn, startingWeight, measurements } = body;

  const { data: existingProfile } = await client
    .from("profiles")
    .select("goal, program_id")
    .eq("id", session.id)
    .single();

  const goal = existingProfile?.goal ?? body.goal;
  if (!GOALS.includes(goal)) {
    return NextResponse.json({ error: "Invalid goal." }, { status: 400 });
  }

  let programId = existingProfile?.program_id ?? null;

  if (!programId) {
    // Find the shared template for this goal, then copy it into a client-owned instance
    // so Jon can later customize this client's program without touching the shared template.
    const admin = supabaseAdmin();
    const { data: template, error: templateErr } = await admin
      .from("programs")
      .select("*")
      .eq("goal", goal)
      .eq("is_default_template", true)
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
    programId = instance.id;
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
      program_id: programId,
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

  return NextResponse.json({ ok: true, programId });
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
