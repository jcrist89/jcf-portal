import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED = new Set(["scheduled", "completed", "canceled"]);

export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx || ctx.session.role !== "coach") {
    return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const requestId = String(body?.requestId ?? "");
  const status = String(body?.status ?? "");

  if (!requestId || !ALLOWED.has(status)) {
    return NextResponse.json({ error: "Valid requestId and status are required." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status,
    updated_at: now,
  };
  if (status === "completed" || status === "canceled") updates.resolved_at = now;

  const { data, error } = await admin
    .from("jcf_private_session_requests")
    .update(updates)
    .eq("id", requestId)
    .select("id, status")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Session request not found." }, { status: 404 });

  return NextResponse.json({ request: data });
}
