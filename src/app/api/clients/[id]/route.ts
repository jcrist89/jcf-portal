import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generatePin, hashPin } from "@/lib/auth/pin";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await supabaseForRequest();
  if (!ctx || ctx.session.role !== "coach") {
    return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const admin = supabaseAdmin();

  if (body.resetPin) {
    const newPin = generatePin(6);
    const pinHash = await hashPin(newPin);
    const { error } = await admin.from("profiles").update({ pin_hash: pinHash }).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, pin: newPin });
  }

  const allowed = ["full_name", "birthday", "height_in", "current_weight", "starting_weight", "goal", "program_id", "is_active"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data: profile, error } = await admin
    .from("profiles")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await supabaseForRequest();
  if (!ctx || ctx.session.role !== "coach") {
    return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  }
  const admin = supabaseAdmin();
  const { error } = await admin.from("profiles").update({ is_active: false }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
