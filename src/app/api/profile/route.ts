import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseForRequest } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Goal, ProgramStructure, UnitSystem } from "@/lib/types";
import { trainingDateIn, DEFAULT_TIMEZONE } from "@/lib/localDate";
import {
  calculateNutritionTargets,
  fitProgramToTrainingDays,
  heightToInches,
  weightToPounds,
} from "@/lib/onboarding";
import { assignProgram } from "@/server/schedule";

const onboardingSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  goal: z.enum(["fat_loss", "recomposition", "muscle_gain", "strength"]),
  sex: z.enum(["female", "male"]),
  age: z.number().int().min(13).max(100),
  units: z.enum(["imperial", "metric"]),
  height: z.number().positive(),
  weight: z.number().positive(),
  experience: z.enum(["beginner", "intermediate", "advanced"]),
  trainingDays: z.number().int().min(2).max(6),
  equipment: z.array(z.string().trim().min(1).max(50)).min(1).max(12),
  dietaryPreferences: z.array(z.string().trim().min(1).max(50)).max(12).default([]),
  dietaryNotes: z.string().trim().max(500).optional().default(""),
});

function validBodyRange(height: number, weight: number, units: UnitSystem): boolean {
  return units === "metric"
    ? height >= 120 && height <= 230 && weight >= 35 && weight <= 350
    : height >= 48 && height <= 90 && weight >= 80 && weight <= 700;
}

/** Complete onboarding, calculate JCF targets, and assign a personalized copy of the
 * matching goal template. Jon can replace the assignment later from the coach view. */
export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const parsed = onboardingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the highlighted onboarding fields." }, { status: 400 });
  }

  const input = parsed.data;
  if (!validBodyRange(input.height, input.weight, input.units)) {
    return NextResponse.json({ error: "Height or weight is outside the supported range." }, { status: 400 });
  }

  const { session, profile } = ctx;
  const admin = supabaseAdmin();
  const goal = input.goal as Goal;
  const weightLb = weightToPounds(input.weight, input.units);
  const heightIn = heightToInches(input.height, input.units);
  const targets = calculateNutritionTargets(weightLb, goal);
  let programId = profile.program_id;

  if (!programId) {
    const { data: template, error: templateError } = await admin
      .from("programs")
      .select("*")
      .eq("goal", goal)
      .eq("is_default_template", true)
      .maybeSingle();

    if (templateError || !template) {
      return NextResponse.json({ error: "No starting template is available for that goal." }, { status: 500 });
    }

    const structure = fitProgramToTrainingDays(
      template.structure as ProgramStructure,
      input.trainingDays,
    );
    const equipmentSummary = input.equipment.join(", ");
    const startsOn = trainingDateIn(profile.timezone || DEFAULT_TIMEZONE);
    const { data: instance, error: instanceError } = await admin
      .from("programs")
      .insert({
        goal,
        name: template.name,
        description: `${template.description ?? "JCF starting program"} Personalized for ${input.trainingDays} training days. Equipment: ${equipmentSummary}.`,
        structure,
        is_template: false,
        is_default_template: false,
        client_id: session.id,
        starts_on: startsOn,
        schedule_mode: "sequential",
      })
      .select("id")
      .single();

    if (instanceError || !instance) {
      return NextResponse.json({ error: instanceError?.message ?? "Could not create the starting program." }, { status: 500 });
    }

    programId = instance.id;
    const assignment = await assignProgram(admin, {
      profileId: session.id,
      programId: instance.id,
      startsOn,
      timezone: profile.timezone || DEFAULT_TIMEZONE,
      scheduleMode: "sequential",
      createdBy: session.id,
    });
    if (assignment.error) {
      return NextResponse.json({ error: assignment.error }, { status: 500 });
    }
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: input.fullName,
      sex: input.sex,
      age: input.age,
      height_in: Number(heightIn.toFixed(2)),
      starting_weight: Number(weightLb.toFixed(2)),
      current_weight: Number(weightLb.toFixed(2)),
      preferred_units: input.units,
      experience_level: input.experience,
      training_days: input.trainingDays,
      available_equipment: input.equipment,
      dietary_preferences: input.dietaryPreferences,
      dietary_notes: input.dietaryNotes || null,
      maintenance_calories: targets.maintenanceCalories,
      target_calories: targets.targetCalories,
      protein_grams: targets.proteinGrams,
      carb_grams: targets.carbGrams,
      fat_grams: targets.fatGrams,
      goal,
      program_id: programId,
      onboarded: true,
    })
    .eq("id", session.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  await admin.from("measurements").insert({
    profile_id: session.id,
    weight: Number(weightLb.toFixed(2)),
    notes: "Initial onboarding check-in",
  });

  return NextResponse.json({ ok: true, programId, targets });
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
