import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { fetchClientTimelinePage } from "@/lib/coachTimeline";

// Coach-only, paginated chronological activity feed for one client. RLS also
// backs this (workout_logs/measurements/etc. select policies already allow
// is_coach() full read access), but the role check gives a clean 403 instead of
// silently returning nothing to a client who guessed another client's id.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await supabaseForRequest();
  if (!ctx || ctx.session.role !== "coach") {
    return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before") ?? undefined;
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 100 ? limitParam : 25;

  const page = await fetchClientTimelinePage(ctx.client, params.id, { before, limit });
  return NextResponse.json(page);
}
