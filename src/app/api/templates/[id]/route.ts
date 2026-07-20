import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";

/** Coach-only: edit a program template's (or a client-specific program's) structure. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await supabaseForRequest();
  if (!ctx || ctx.session.role !== "coach") {
    return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  }
  const { client } = ctx;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const allowed = ["name", "description", "structure"];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data: program, error } = await client
    .from("programs")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ program });
}
