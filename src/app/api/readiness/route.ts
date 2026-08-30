import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { scoreReadiness } from "@/lib/meetPrep/readiness";
import { notifyLowReadiness } from "@/lib/push";
import { resolveProfileId, timezoneFor } from "@/lib/auth/authorize";
import { resolveLocalDate } from "@/lib/localDate";

export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client } = ctx;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const fields = ["sleep", "fatigue", "soreness", "jointPain", "stress", "motivation", "nutrition", "confidence"];
  for (const f of fields) {
    if (typeof body[f] !== "number" || body[f] < 1 || body[f] > 5) {
      return NextResponse.json({ error: `${f} must be a number between 1 and 5.` }, { status: 400 });
    }
  }

  const profileId = resolveProfileId(ctx, body.profileId);
  const checkinDate = resolveLocalDate(body.date, await timezoneFor(ctx, profileId));
  const { score, tier } = scoreReadiness({
    sleep: body.sleep,
    fatigue: body.fatigue,
    soreness: body.soreness,
    jointPain: body.jointPain,
    stress: body.stress,
    motivation: body.motivation,
    nutrition: body.nutrition,
    confidence: body.confidence,
  });

  const { data: readiness, error } = await client
    .from("readiness_checkins")
    .upsert(
      {
        profile_id: profileId,
        date: checkinDate,
        sleep: body.sleep,
        fatigue: body.fatigue,
        soreness: body.soreness,
        joint_pain: body.jointPain,
        stress: body.stress,
        motivation: body.motivation,
        nutrition: body.nutrition,
        confidence: body.confidence,
        score,
        tier,
      },
      { onConflict: "profile_id,date" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (tier === "low" || tier === "very_low") {
    await notifyLowReadiness(profileId, tier);
  }
  return NextResponse.json({ readiness });
}
