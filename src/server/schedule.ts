import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScheduleAssignment, ScheduledSession } from "@/domain/schedule";
import type { ProgramAssignment } from "@/lib/types";

const SESSION_COLUMNS =
  "id, week_number, day_number, sequence, scheduled_local_date, label, status";

export interface LoadedSchedule {
  assignment: ScheduleAssignment | null;
  sessions: ScheduledSession[];
}

/**
 * The active assignment and its sessions. One row per prescribed session, so "what is
 * due" is an ordered read rather than a calculation over the whole program.
 */
export async function loadSchedule(
  client: SupabaseClient,
  profileId: string,
): Promise<LoadedSchedule> {
  const { data: assignment } = await client
    .from("program_assignments")
    .select("id, program_id, starts_on, schedule_mode, timezone")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .maybeSingle();

  if (!assignment) return { assignment: null, sessions: [] };

  const { data: sessions } = await client
    .from("assignment_sessions")
    .select(SESSION_COLUMNS)
    .eq("assignment_id", assignment.id)
    .order("sequence", { ascending: true });

  return {
    assignment: assignment as ScheduleAssignment,
    sessions: (sessions ?? []) as ScheduledSession[],
  };
}

export interface SessionExerciseSummary {
  name: string;
  sets: string | null;
  reps: string | null;
}

/** The prescription for one session, in order, with catalog names resolved. */
export async function loadSessionExercises(
  client: SupabaseClient,
  sessionId: string,
): Promise<SessionExerciseSummary[]> {
  // The embed is pinned to a named constraint on purpose: session_exercises has two
  // foreign keys into exercises (exercise_id and substitute_exercise_id), so an
  // unqualified `exercises(name)` is ambiguous and PostgREST rejects the whole request.
  const { data } = await client
    .from("session_exercises")
    .select(
      "position, prescribed_sets, prescribed_reps, exercises!session_exercises_exercise_id_fkey(name)",
    )
    .eq("session_id", sessionId)
    .order("position", { ascending: true });

  return (data ?? []).map((row: any) => ({
    name: row.exercises?.name ?? "",
    sets: row.prescribed_sets,
    reps: row.prescribed_reps,
  }));
}

/**
 * Points a client at a program and expands it into dated sessions.
 *
 * Supersedes any assignment already running rather than deleting it — the sessions of a
 * previous block are the record of what that person actually did, and a partial unique
 * index allows only one active assignment per client, so leaving the old one active
 * would reject the new one outright.
 *
 * Must run with the service-role client: assignment_sessions and session_exercises are
 * server-write-only, and materialize_assignment_sessions is not executable by
 * authenticated.
 */
export async function assignProgram(
  admin: SupabaseClient,
  opts: {
    profileId: string;
    programId: string;
    startsOn: string;
    timezone: string;
    scheduleMode: "sequential" | "date_anchored";
    engagementId?: string | null;
    createdBy?: string | null;
  },
): Promise<{ assignment: ProgramAssignment | null; sessions: number; error?: string }> {
  const { data: existing } = await admin
    .from("program_assignments")
    .select("id")
    .eq("profile_id", opts.profileId)
    .eq("status", "active")
    .maybeSingle();

  const { data: assignment, error } = await admin
    .from("program_assignments")
    .insert({
      profile_id: opts.profileId,
      program_id: opts.programId,
      engagement_id: opts.engagementId ?? null,
      starts_on: opts.startsOn,
      timezone: opts.timezone,
      schedule_mode: opts.scheduleMode,
      status: "active",
      created_by: opts.createdBy ?? null,
    })
    .select()
    .single();

  if (error || !assignment) {
    return { assignment: null, sessions: 0, error: error?.message ?? "Could not create assignment." };
  }

  if (existing) {
    await admin
      .from("program_assignments")
      .update({ status: "superseded", superseded_by: assignment.id, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  }

  const { data: built, error: rpcError } = await admin.rpc("materialize_assignment_sessions", {
    p_assignment_id: assignment.id,
  });

  if (rpcError) {
    return {
      assignment: assignment as ProgramAssignment,
      sessions: 0,
      error: `Assignment created but sessions could not be built: ${rpcError.message}`,
    };
  }

  return { assignment: assignment as ProgramAssignment, sessions: Number(built ?? 0) };
}

/**
 * Rebuilds the unstarted sessions of a client's active assignment after their program
 * changed. Without this a program edit would leave the schedule describing the old
 * block — the exact drift materializing was supposed to remove.
 */
export async function rematerializeForProgram(
  admin: SupabaseClient,
  programId: string,
): Promise<number> {
  const { data: assignments } = await admin
    .from("program_assignments")
    .select("id")
    .eq("program_id", programId)
    .eq("status", "active");

  let rebuilt = 0;
  for (const a of assignments ?? []) {
    const { error } = await admin.rpc("materialize_assignment_sessions", { p_assignment_id: a.id });
    if (!error) rebuilt += 1;
  }
  return rebuilt;
}

/**
 * Marks the scheduled session a workout satisfied.
 *
 * Scoped by profile id as well as session id: `assignmentSessionId` arrives in a request
 * body, so without that predicate a client could close another client's session by
 * guessing an id. Scoped to 'prescribed' too, so re-submitting a workout cannot reopen
 * and rewrite a session that was already resolved — the closest thing to idempotency
 * available until the mutation-receipt work lands.
 */
export async function completeScheduledSession(
  admin: SupabaseClient,
  opts: {
    sessionId: string;
    profileId: string;
    workoutLogId: string;
    completedOn: string;
    scalingMode?: string | null;
    scalingReason?: string | null;
  },
): Promise<boolean> {
  const scaled = opts.scalingMode != null;
  const { data } = await admin
    .from("assignment_sessions")
    .update({
      status: scaled ? "scaled" : "completed",
      workout_log_id: opts.workoutLogId,
      completed_on: opts.completedOn,
      scaling_mode: opts.scalingMode ?? null,
      scaling_reason: opts.scalingReason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.sessionId)
    .eq("profile_id", opts.profileId)
    .in("status", ["prescribed", "in_progress"])
    .select("id");

  return (data?.length ?? 0) > 0;
}
