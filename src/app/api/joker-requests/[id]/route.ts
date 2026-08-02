import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { notifyJokerResolved } from "@/lib/push";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const { data: existing } = await client.from("joker_requests").select("*").eq("id", params.id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Joker request not found." }, { status: 404 });

  const updates: Record<string, unknown> = {};

  if (body.status === "approved" || body.status === "denied") {
    if (session.role !== "coach") {
      return NextResponse.json({ error: "Coach access required to approve or deny." }, { status: 403 });
    }
    updates.status = body.status;
    updates.resolved_at = new Date().toISOString();
    updates.resolved_by = session.id;
    if (typeof body.coachResponse === "string") updates.coach_response = body.coachResponse;
    if (body.status === "approved" && typeof body.maxPermittedWeight === "number") {
      updates.max_permitted_weight = body.maxPermittedWeight;
    }
  } else if (body.status === "completed" || body.status === "failed_compliance") {
    if (existing.status !== "approved") {
      return NextResponse.json({ error: "This joker set hasn't been approved yet." }, { status: 400 });
    }
    updates.status = body.status;
    if (typeof body.actualWeight === "number") updates.actual_weight = body.actualWeight;
    if (typeof body.actualRpe === "number") updates.actual_rpe = body.actualRpe;
    if (typeof body.technicalResult === "string") updates.technical_result = body.technicalResult;
  } else if (body.status) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data: jokerRequest, error } = await client
    .from("joker_requests")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (body.status === "approved" || body.status === "denied") {
    await notifyJokerResolved(existing.profile_id, body.status);
  }
  return NextResponse.json({ jokerRequest });
}
