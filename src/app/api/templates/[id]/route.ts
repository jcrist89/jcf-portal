import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rematerializeForProgram } from "@/server/schedule";

/**
 * Edit a program's structure — either a coach editing a shared template, or a
 * client editing their own program instance. Permission is enforced entirely by
 * RLS (`programs_update`): coaches can edit anything, clients can only edit their
 * own non-template row and only at paid_programming/paid_coaching tier. We don't
 * duplicate that check here — if RLS rejects the row, the update just matches zero
 * rows, which we surface as a 403 rather than a silent no-op.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client } = ctx;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const allowed = ["name", "description", "structure", "attempt_plan", "weaknesses"];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data: program, error } = await client
    .from("programs")
    .update(updates)
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!program) {
    return NextResponse.json(
      { error: "You don't have permission to edit this program. Upgrade your plan to unlock editing." },
      { status: 403 }
    );
  }
  // Editing the structure changes what the remaining sessions should contain. Without
  // rebuilding them the schedule would keep describing the old block — precisely the
  // drift materializing exists to remove. Only unstarted sessions are touched, so a
  // session that already happened is never rewritten.
  if ("structure" in body) {
    await rematerializeForProgram(supabaseAdmin(), params.id);
  }

  return NextResponse.json({ program });
}
