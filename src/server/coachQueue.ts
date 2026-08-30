import type { SupabaseClient } from "@supabase/supabase-js";
import { schedulePosition, type ScheduledSession } from "@/domain/schedule";
import {
  buildQueue,
  REPEATED_SCALING_WINDOW_DAYS,
  type ClientSnapshot,
  type QueueEntry,
  type SuppressedSignal,
} from "@/domain/signals";
import type { Engagement } from "@/domain/engagement";
import { trainingDateIn } from "@/lib/localDate";

const MESSAGE_PREVIEW_CHARS = 70;

/**
 * Builds the whole coach queue.
 *
 * Every query is scoped to the active clients on this page and pulls only the columns
 * the signals need. The previous coach dashboard selected whole rows from workout_logs
 * for every client and then recomputed each summary — nine queries per realtime event —
 * which silently truncates at PostgREST's 1000-row cap as history accumulates. This is
 * a fixed number of bounded reads regardless of roster size.
 */
export async function loadCoachQueue(
  client: SupabaseClient,
  now: Date = new Date(),
): Promise<{ queue: QueueEntry[]; clientCount: number }> {
  const { data: profiles } = await client
    .from("profiles")
    .select("id, full_name, timezone")
    .eq("role", "client")
    .eq("is_active", true);

  const clients = profiles ?? [];
  if (clients.length === 0) return { queue: [], clientCount: 0 };

  const ids = clients.map((c) => c.id);
  const scalingWindowStart = new Date(now);
  scalingWindowStart.setUTCDate(scalingWindowStart.getUTCDate() - REPEATED_SCALING_WINDOW_DAYS);
  const scalingWindow = scalingWindowStart.toISOString().slice(0, 10);

  const [
    { data: assignments },
    { data: sessions },
    { data: engagements },
    { data: notes },
    { data: habits },
    { data: suppressions },
  ] = await Promise.all([
    client
      .from("program_assignments")
      .select("id, profile_id, starts_on, schedule_mode, timezone")
      .in("profile_id", ids)
      .eq("status", "active"),
    client
      .from("assignment_sessions")
      .select(
        "id, profile_id, assignment_id, week_number, day_number, sequence, scheduled_local_date, label, status, scaling_mode, scaling_reason, completed_on",
      )
      .in("profile_id", ids),
    client
      .from("client_engagements")
      .select("*")
      .in("profile_id", ids)
      .in("status", ["pending", "active", "past_due"]),
    // Newest first, so the first row per client per author is the latest one.
    client
      .from("coach_notes")
      .select("id, profile_id, author, message, created_at")
      .in("profile_id", ids)
      .order("created_at", { ascending: false }),
    client
      .from("habit_days")
      .select("profile_id, local_date, succeeded")
      .in("profile_id", ids)
      .order("local_date", { ascending: false }),
    client.from("coach_signal_actions").select("profile_id, signal_kind, fingerprint, action, snoozed_until"),
  ]);

  const byProfile = <T extends { profile_id: string }>(rows: T[] | null) => {
    const map = new Map<string, T[]>();
    for (const r of rows ?? []) {
      const list = map.get(r.profile_id);
      if (list) list.push(r);
      else map.set(r.profile_id, [r]);
    }
    return map;
  };

  const assignmentByProfile = new Map((assignments ?? []).map((a: any) => [a.profile_id, a]));
  const sessionsByProfile = byProfile(sessions as any[]);
  const engagementByProfile = new Map((engagements ?? []).map((e: any) => [e.profile_id, e as Engagement]));
  const notesByProfile = byProfile(notes as any[]);
  const habitsByProfile = byProfile(habits as any[]);
  const suppressionsByProfile = byProfile(suppressions as any[]);

  const entries = clients.map((profile) => {
    const assignment = assignmentByProfile.get(profile.id) ?? null;
    const mySessions = (sessionsByProfile.get(profile.id) ?? []).filter(
      (s: any) => !assignment || s.assignment_id === assignment.id,
    );
    const today = trainingDateIn(profile.timezone ?? "UTC", now);

    const position = schedulePosition(
      assignment,
      mySessions as unknown as ScheduledSession[],
      today,
    );

    const myNotes = notesByProfile.get(profile.id) ?? [];
    const latestClient = myNotes.find((n: any) => n.author === "client") ?? null;
    const latestCoach = myNotes.find((n: any) => n.author === "coach") ?? null;

    // Most recent thing this person actually did — a session or a habit tap. Habits
    // count: someone hitting their protein every day but not training is not silent.
    const lastSession = mySessions
      .filter((s: any) => s.completed_on)
      .map((s: any) => s.completed_on as string)
      .sort()
      .pop();
    const lastHabit = (habitsByProfile.get(profile.id) ?? [])
      .map((h: any) => h.local_date as string)
      .sort()
      .pop();
    const lastActivityDate =
      [lastSession, lastHabit].filter(Boolean).sort().pop() ?? null;

    const scaled = mySessions.filter(
      (s: any) => s.status === "scaled" && s.completed_on && s.completed_on >= scalingWindow,
    );

    const snapshot: ClientSnapshot = {
      profileId: profile.id,
      name: profile.full_name ?? "Unnamed client",
      engagement: engagementByProfile.get(profile.id) ?? null,
      schedule: position,
      hasAssignment: assignment != null,
      lastActivityDate,
      latestClientMessageAt: latestClient?.created_at ?? null,
      latestClientMessageId: latestClient?.id ?? null,
      latestClientMessagePreview: latestClient
        ? truncate(latestClient.message, MESSAGE_PREVIEW_CHARS)
        : null,
      latestCoachReplyAt: latestCoach?.created_at ?? null,
      scaledRecently: scaled.length,
      scalingReasons: scaled.map((s: any) => s.scaling_reason).filter(Boolean),
    };

    return {
      snapshot,
      suppressions: (suppressionsByProfile.get(profile.id) ?? []) as unknown as SuppressedSignal[],
    };
  });

  // The coach's own local date decides "today" for ordering and snooze expiry.
  const coachToday = trainingDateIn("America/Toronto", now);

  return {
    queue: buildQueue(entries, now.toISOString(), coachToday),
    clientCount: clients.length,
  };
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
