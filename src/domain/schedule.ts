/**
 * Scheduling rules. Pure — no Supabase, no Next, no React.
 *
 * Reads the materialized sessions of an assignment and answers the only question the
 * Today screen actually asks: what should this person do right now. Replaces deriving
 * that from `completedCount % totalDays`, which silently restarted a block at week 1
 * and had no notion of a calendar at all.
 *
 * Dates are compared as ISO strings, which sort correctly and avoid timezone drift —
 * `today` is resolved once, in the client's own zone, by the caller.
 */

import type { ScheduleMode, SessionStatus } from "@/lib/types";

export interface ScheduledSession {
  id: string;
  week_number: number;
  day_number: number;
  sequence: number;
  scheduled_local_date: string | null;
  label: string | null;
  status: SessionStatus;
}

export interface ScheduleAssignment {
  id: string;
  starts_on: string;
  schedule_mode: ScheduleMode;
  timezone: string;
}

export interface Adherence {
  completed: number;
  scaled: number;
  missed: number;
  /** Sessions whose moment has passed, one way or another. The denominator. */
  accountedFor: number;
  /** Null until at least one session has come due — 0% on day one is a lie. */
  pct: number | null;
}

export interface SchedulePosition {
  /** The session to serve, or null when there is nothing due. */
  session: ScheduledSession | null;
  /** True when `session` is what this person should do today, rather than a preview. */
  dueToday: boolean;
  /** 1-based calendar week of the block. */
  calendarWeek: number | null;
  totalWeeks: number;
  /** Every prescribed session has been dealt with. */
  complete: boolean;
  /** Sequential only: sessions the calendar expected that haven't happened. */
  sessionsBehind: number;
  adherence: Adherence;
}

const EMPTY: SchedulePosition = {
  session: null,
  dueToday: false,
  calendarWeek: null,
  totalWeeks: 0,
  complete: false,
  sessionsBehind: 0,
  adherence: { completed: 0, scaled: 0, missed: 0, accountedFor: 0, pct: null },
};

/** Days between two ISO dates. Positive when `to` is later. */
function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

/**
 * A date-anchored session whose day has passed without being performed is missed,
 * whether or not the nightly sweep has run yet. The sweep persists this so the coach
 * dashboard can query it; deriving it here too means a late or failed cron degrades
 * into stale reporting rather than into a client being served a session from last week.
 */
function isDerivedMissed(
  session: ScheduledSession,
  mode: ScheduleMode,
  today: string,
): boolean {
  return (
    mode === "date_anchored" &&
    session.status === "prescribed" &&
    session.scheduled_local_date != null &&
    session.scheduled_local_date < today
  );
}

/** 1-based calendar week of a block. The only week number that means anything once a
 *  client can miss sessions — counting completed workouts answers a different question. */
export function calendarWeekOf(startsOn: string | null, today: string): number {
  if (!startsOn) return 1;
  return Math.max(1, Math.floor(daysBetween(startsOn, today) / 7) + 1);
}

export function schedulePosition(
  assignment: ScheduleAssignment | null,
  sessions: ScheduledSession[],
  today: string,
): SchedulePosition {
  if (!assignment || sessions.length === 0) return EMPTY;

  const ordered = [...sessions].sort((a, b) => a.sequence - b.sequence);
  const mode = assignment.schedule_mode;

  const totalWeeks = ordered.reduce((max, s) => Math.max(max, s.week_number), 0);
  const calendarWeek = calendarWeekOf(assignment.starts_on, today);

  let completed = 0;
  let scaled = 0;
  let missed = 0;
  for (const s of ordered) {
    if (s.status === "completed") completed += 1;
    else if (s.status === "scaled") scaled += 1;
    else if (s.status === "skipped" || isDerivedMissed(s, mode, today)) missed += 1;
  }
  const accountedFor = completed + scaled + missed;
  const adherence: Adherence = {
    completed,
    scaled,
    missed,
    accountedFor,
    // A scaled session counts. That is the entire point of Rough Shift — preserving
    // momentum instead of recording a failure — and adherence has to agree with it.
    pct: accountedFor === 0 ? null : Math.round(((completed + scaled) / accountedFor) * 100),
  };

  const outstanding = ordered.filter(
    (s) => s.status === "prescribed" && !isDerivedMissed(s, mode, today),
  );

  if (outstanding.length === 0) {
    return {
      ...EMPTY,
      calendarWeek,
      totalWeeks,
      complete: true,
      adherence,
    };
  }

  if (mode === "date_anchored") {
    // The calendar decides. A session scheduled for a day that has passed is gone, so
    // only today's counts as due — queuing missed work is exactly what would stop a
    // taper landing on the meet.
    const dueNow = outstanding.find((s) => s.scheduled_local_date === today) ?? null;
    const upcoming = outstanding.find(
      (s) => s.scheduled_local_date != null && s.scheduled_local_date > today,
    ) ?? null;

    return {
      session: dueNow ?? upcoming,
      dueToday: dueNow != null,
      calendarWeek,
      totalWeeks,
      complete: false,
      sessionsBehind: 0,
      adherence,
    };
  }

  // Sequential: serve the next undone session and let a missed one wait. The calendar is
  // used only to report how far behind the block this person has fallen.
  const next = outstanding[0];
  const behind = outstanding.filter(
    (s) => s.scheduled_local_date != null && s.scheduled_local_date < today,
  ).length;

  return {
    session: next,
    dueToday: true,
    calendarWeek,
    totalWeeks,
    complete: false,
    sessionsBehind: behind,
    adherence,
  };
}
