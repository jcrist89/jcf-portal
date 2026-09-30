import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function clean(value: unknown, max = 3000): string | null {
  const text = String(value ?? "").trim().slice(0, max);
  return text || null;
}

export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx || ctx.session.role !== "coach") {
    return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const weekStart = String(body?.weekStart ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: "Valid weekStart is required." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("jcf_weekly_business_reviews")
    .upsert({
      week_start: weekStart,
      wins: clean(body.wins),
      bottleneck: clean(body.bottleneck),
      next_experiment: clean(body.nextExperiment),
      decisions: clean(body.decisions),
      completed_at: now,
      updated_at: now,
    }, { onConflict: "week_start" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ review: data });
}
