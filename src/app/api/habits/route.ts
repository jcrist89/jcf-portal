import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { resolveProfileId, timezoneFor } from "@/lib/auth/authorize";
import { resolveLocalDate } from "@/lib/localDate";
import { HABIT_KEYS, type HabitKey } from "@/domain/consistency";

/**
 * Records one habit tap.
 *
 * Idempotent by construction: habit_days is keyed on (profile_id, local_date), so the
 * same tap replayed from an offline outbox any number of times converges on the same
 * row. No receipt table needed — unlike workout completion, this has no effects beyond
 * a single row.
 *
 * The write is a full upsert of the named habit rather than a read-modify-write, so two
 * taps racing on different habits cannot clobber each other: each sends only its own
 * column, and the row is merged.
 */
export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client } = ctx;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const habit = body.habit as HabitKey;
  if (!HABIT_KEYS.includes(habit)) {
    return NextResponse.json(
      { error: `habit must be one of ${HABIT_KEYS.join(", ")}.` },
      { status: 400 },
    );
  }
  if (typeof body.done !== "boolean") {
    return NextResponse.json({ error: "done must be true or false." }, { status: 400 });
  }

  const profileId = resolveProfileId(ctx, body.profileId);
  // The client's training day, so a tap at 01:30 lands on the day they just finished.
  const localDate = resolveLocalDate(body.localDate, await timezoneFor(ctx, profileId));

  const { data, error } = await client
    .from("habit_days")
    .upsert(
      { profile_id: profileId, local_date: localDate, [habit]: body.done, updated_at: new Date().toISOString() },
      { onConflict: "profile_id,local_date" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ day: data });
}
