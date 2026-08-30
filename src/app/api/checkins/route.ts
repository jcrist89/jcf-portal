import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveProfileId, timezoneFor, requireExistingClient } from "@/lib/auth/authorize";
import { trainingDateIn } from "@/lib/localDate";
import { currentCheckinDate } from "@/domain/checkin";
import type { Engagement } from "@/domain/engagement";

const NUMERIC = [
  "weight", "waist", "sleep_avg", "night_shifts", "steps_avg",
  "nutrition_adherence", "protein_days", "alcohol_drinks", "energy", "stress",
] as const;
const TEXT = ["win", "struggle", "ask"] as const;

/**
 * Submits a client's weekly check-in.
 *
 * Idempotent on (profile_id, due_local_date): a retried submit from a bad connection
 * updates the same week's row rather than creating a second one. The due date is derived
 * from the engagement rather than taken from the request, so a client cannot file a
 * check-in against a week that was never theirs.
 *
 * Weight and waist are the only required answers. Everything else is optional because
 * the form has to be finishable in under three minutes by someone who has just worked a
 * night shift — a required field they don't have an answer for is where they abandon it.
 */
export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client } = ctx;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const profileId = resolveProfileId(ctx, body.profileId);

  if (body.weight == null || body.waist == null) {
    return NextResponse.json(
      { error: "Weight and waist are needed — everything else is optional." },
      { status: 400 },
    );
  }

  const { data: engagementRow } = await client
    .from("client_engagements")
    .select("*")
    .eq("profile_id", profileId)
    .in("status", ["pending", "active", "past_due"])
    .maybeSingle();

  const engagement = (engagementRow as Engagement | null) ?? null;
  const today = trainingDateIn(await timezoneFor(ctx, profileId));
  const dueOn = currentCheckinDate(engagement, today) ?? today;

  const payload: Record<string, unknown> = {
    profile_id: profileId,
    engagement_id: engagement?.id ?? null,
    due_local_date: dueOn,
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  for (const key of NUMERIC) {
    if (body[key] != null && body[key] !== "") payload[key] = Number(body[key]);
  }
  for (const key of TEXT) {
    if (typeof body[key] === "string" && body[key].trim()) payload[key] = body[key].trim();
  }

  const { data, error } = await client
    .from("checkins")
    .upsert(payload, { onConflict: "profile_id,due_local_date" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Weight and waist also belong in the measurement series the progress charts read.
  await client.from("measurements").insert({
    profile_id: profileId,
    date: dueOn,
    weight: Number(body.weight),
    waist: Number(body.waist),
    notes: "Weekly check-in",
  });
  await client.from("profiles").update({ current_weight: Number(body.weight) }).eq("id", profileId);

  return NextResponse.json({ checkin: data });
}

/**
 * The coach's half. Writing a response is what closes the loop and clears the signal —
 * marking something reviewed without replying leaves the client having heard nothing,
 * which is the failure the whole queue exists to prevent.
 */
export async function PATCH(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx || ctx.session.role !== "coach") {
    return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const checkinId = String(body?.checkinId ?? "");
  if (!checkinId) return NextResponse.json({ error: "checkinId is required." }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: existing } = await admin
    .from("checkins")
    .select("id, profile_id")
    .eq("id", checkinId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Check-in not found." }, { status: 404 });

  const targetCheck = await requireExistingClient(admin, existing.profile_id);
  if (targetCheck) return targetCheck;

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { reviewed_at: now, updated_at: now };

  const response = typeof body.response === "string" ? body.response.trim() : "";
  if (response) {
    updates.coach_response = response;
    updates.coach_responded_at = now;
  }

  const { data, error } = await admin
    .from("checkins")
    .update(updates)
    .eq("id", checkinId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The response also lands in the message thread, so the client sees it where they
  // already look rather than having to go back to a form they submitted days ago.
  if (response) {
    await admin.from("coach_notes").insert({
      profile_id: existing.profile_id,
      author: "coach",
      message: response,
      read: false,
    });
  }

  return NextResponse.json({ checkin: data });
}
