import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";

const FORM_TYPES = ["workout", "measurement", "pr"] as const;

/** Server-side half of the draft-autosave system: a lightweight staging row
 * per (profile, form type, draft key), upserted as the client types and
 * deleted on confirmed submit. Never touches workout_logs/measurements/prs —
 * those only ever see confirmed data, same as before this existed. */
export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;

  const body = await req.json().catch(() => null);
  const formType = body?.formType;
  const draftKey = String(body?.draftKey ?? "");
  if (!FORM_TYPES.includes(formType) || !draftKey) {
    return NextResponse.json({ error: "Invalid draft." }, { status: 400 });
  }

  const { error } = await client.from("form_drafts").upsert(
    {
      profile_id: session.id,
      form_type: formType,
      draft_key: draftKey,
      payload: body.payload ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,form_type,draft_key" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;

  const { searchParams } = new URL(req.url);
  const formType = searchParams.get("formType");
  const draftKey = searchParams.get("draftKey") ?? "";
  if (!FORM_TYPES.includes(formType as any) || !draftKey) {
    return NextResponse.json({ error: "Invalid draft." }, { status: 400 });
  }

  const { data } = await client
    .from("form_drafts")
    .select("payload, updated_at")
    .eq("profile_id", session.id)
    .eq("form_type", formType)
    .eq("draft_key", draftKey)
    .maybeSingle();

  return NextResponse.json({ draft: data ?? null });
}

export async function DELETE(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;

  const body = await req.json().catch(() => null);
  const formType = body?.formType;
  const draftKey = String(body?.draftKey ?? "");
  if (!FORM_TYPES.includes(formType) || !draftKey) {
    return NextResponse.json({ error: "Invalid draft." }, { status: 400 });
  }

  await client
    .from("form_drafts")
    .delete()
    .eq("profile_id", session.id)
    .eq("form_type", formType)
    .eq("draft_key", draftKey);

  return NextResponse.json({ ok: true });
}
