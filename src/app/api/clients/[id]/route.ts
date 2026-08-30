import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireExistingClient, isResponse } from "@/lib/auth/authorize";
import type { SupabaseClient } from "@supabase/supabase-js";
import { trainingDateIn, DEFAULT_TIMEZONE } from "@/lib/localDate";
import { assignProgram } from "@/server/schedule";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await supabaseForRequest();
  if (!ctx || ctx.session.role !== "coach") {
    return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const admin = supabaseAdmin();

  // params.id is fully caller-controlled and this route writes via the
  // service-role client (bypasses RLS) — confirm it actually targets a client
  // profile before doing anything, rather than trusting it blindly.
  const targetCheck = await requireExistingClient(admin, params.id);
  if (targetCheck) return targetCheck;

  if (body.sendPasswordReset) {
    const { data: profile } = await admin.from("profiles").select("email").eq("id", params.id).maybeSingle();
    if (!profile?.email) {
      return NextResponse.json({ error: "This client has no email on file." }, { status: 400 });
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const { error } = await admin.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${siteUrl}/reset-password`,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const allowed = [
    "full_name",
    "birthday",
    "height_in",
    "current_weight",
    "starting_weight",
    "goal",
    "program_id",
    "is_active",
    "tier",
    "timezone",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Assigning a program means assigning a copy the coach can edit freely — never the
  // shared template row itself. The coach UI used to send the template id straight
  // through, which pointed the client at a row every other client is copied from, so
  // "Edit This Program" for that client rewrote the template for everyone. Signup and
  // onboarding always copied; this is the path that didn't.
  if (typeof updates.program_id === "string") {
    const copyResult = await assignProgramCopy(admin, params.id, updates.program_id);
    if (isResponse(copyResult)) return copyResult;
    updates.program_id = copyResult;

    // A program with no assignment has no schedule, so the client would see nothing to
    // do. Created here rather than lazily on read, so the sessions exist before anyone
    // looks for them.
    const scheduled = await createAssignmentFor(admin, params.id, copyResult);
    if (scheduled) return scheduled;
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
  const targetCheck = await requireExistingClient(admin, params.id);
  if (targetCheck) return targetCheck;

  const { error } = await admin.from("profiles").update({ is_active: false }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * Resolves the program id a client should actually be pointed at.
 *
 * A template id becomes a fresh client-owned copy (is_template false, client_id set,
 * starts_on anchored to today) so the coach can customise it without touching the
 * shared row. An id that's already this client's own program passes through unchanged,
 * which keeps a re-save from spawning duplicate copies. Anything else — another
 * client's program — is rejected.
 *
 * Returns the id to store, or a ready-to-return error response.
 */
async function assignProgramCopy(
  admin: SupabaseClient,
  profileId: string,
  requestedId: string,
): Promise<string | NextResponse> {
  const [{ data: source }, { data: target }] = await Promise.all([
    admin.from("programs").select("*").eq("id", requestedId).maybeSingle(),
    admin.from("profiles").select("timezone").eq("id", profileId).maybeSingle(),
  ]);

  if (!source) return NextResponse.json({ error: "Program not found." }, { status: 404 });

  if (!source.is_template) {
    if (source.client_id !== profileId) {
      return NextResponse.json(
        { error: "That program belongs to another client." },
        { status: 403 },
      );
    }
    return requestedId;
  }

  const { data: copy, error } = await admin
    .from("programs")
    .insert({
      goal: source.goal,
      name: source.name,
      description: source.description,
      structure: source.structure,
      is_template: false,
      is_default_template: false,
      client_id: profileId,
      meet_date: source.meet_date,
      attempt_plan: source.attempt_plan,
      weaknesses: source.weaknesses,
      starts_on: trainingDateIn(target?.timezone || DEFAULT_TIMEZONE),
      schedule_mode: source.meet_date ? "date_anchored" : "sequential",
    })
    .select("id")
    .single();

  if (error || !copy) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create this client's program copy." },
      { status: 500 },
    );
  }
  return copy.id as string;
}

/** Builds the calendar-aware assignment (and its sessions) for a newly assigned program. */
async function createAssignmentFor(
  admin: SupabaseClient,
  profileId: string,
  programId: string,
): Promise<NextResponse | null> {
  const [{ data: prog }, { data: prof }, { data: engagement }] = await Promise.all([
    admin.from("programs").select("starts_on, schedule_mode").eq("id", programId).maybeSingle(),
    admin.from("profiles").select("timezone").eq("id", profileId).maybeSingle(),
    admin
      .from("client_engagements")
      .select("id")
      .eq("profile_id", profileId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const timezone = prof?.timezone || DEFAULT_TIMEZONE;
  const result = await assignProgram(admin, {
    profileId,
    programId,
    startsOn: prog?.starts_on ?? trainingDateIn(timezone),
    timezone,
    scheduleMode: prog?.schedule_mode === "date_anchored" ? "date_anchored" : "sequential",
    engagementId: engagement?.id ?? null,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return null;
}
