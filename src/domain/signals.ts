/**
 * Coach triage. Pure — no Supabase, no Next, no React.
 *
 * Answers "who needs me today", which is the second job the whole product exists for.
 * The screen it feeds is not an alphabetical client grid; it is a ranked list of things
 * that have gone wrong or are about to.
 *
 * Signals are DERIVED, never stored. A stored signal needs a generation job, and the
 * moment that job is late the queue starts lying — showing a problem that is fixed, or
 * missing one that isn't. Computing them on read means the queue is always current, and
 * the only thing that needs persisting is what the coach did about one.
 *
 * Every signal carries a fingerprint: a short string identifying THIS instance of the
 * condition. Resolving "2 sessions missed" must not hide "5 sessions missed" a week
 * later, and the fingerprint is what tells those apart.
 */

import type { Engagement } from "@/domain/engagement";
import type { SchedulePosition } from "@/domain/schedule";

export type SignalKind =
  | "message_unanswered"
  | "sessions_missed"
  | "quiet"
  | "adherence_low"
  | "repeated_scaling"
  | "renewal_due"
  | "engagement_ended";

/** critical = someone is slipping now. high = worth a look. opportunity = money or momentum. */
export type Severity = "critical" | "high" | "opportunity";

/** A client's unanswered message becomes critical past this. */
export const MESSAGE_SLA_HOURS = 24;

export const MISSED_SESSIONS_HIGH = 2;
export const MISSED_SESSIONS_CRITICAL = 4;

/** Only for clients with no schedule at all — otherwise missed sessions is the truer signal. */
export const QUIET_DAYS_HIGH = 6;
export const QUIET_DAYS_CRITICAL = 10;

export const ADHERENCE_FLOOR_PCT = 60;

/**
 * Adherence signals stay quiet until an engagement is this old. A client three weeks in
 * has no baseline to fall below, and a false alarm is most expensive exactly then —
 * there is no relationship yet, and the coach is being trained to distrust the queue.
 */
export const BASELINE_SUPPRESSION_WEEKS = 4;

export const REPEATED_SCALING_COUNT = 3;
export const REPEATED_SCALING_WINDOW_DAYS = 14;

export const RENEWAL_WINDOW_DAYS = 14;

export interface CoachSignal {
  kind: SignalKind;
  severity: Severity;
  /** Identifies this instance of the condition, so a resolved one can't mask a new one. */
  fingerprint: string;
  /** What happened, in a few words. */
  headline: string;
  /** Why the app thinks so — the coach should never have to take it on faith. */
  evidence: string;
  /** What to do about it. */
  action: string;
  /** How long this has been true. Null when it isn't a duration. */
  since: string | null;
}

export interface ClientSnapshot {
  profileId: string;
  name: string;
  engagement: Engagement | null;
  schedule: SchedulePosition;
  hasAssignment: boolean;
  /** Latest completed session or habit day. */
  lastActivityDate: string | null;
  latestClientMessageAt: string | null;
  latestClientMessageId: string | null;
  latestClientMessagePreview: string | null;
  latestCoachReplyAt: string | null;
  scaledRecently: number;
  scalingReasons: string[];
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, opportunity: 2 };

function hoursBetween(from: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(from)) / 3_600_000;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Every signal currently true for one client, most urgent first.
 *
 * `now` is an ISO timestamp; `today` is the coach's local date. Both are passed in
 * rather than read, so the whole thing stays testable and time-independent.
 */
export function signalsFor(
  snapshot: ClientSnapshot,
  now: string,
  today: string,
): CoachSignal[] {
  const out: CoachSignal[] = [];
  const { engagement, schedule } = snapshot;

  // ── an unanswered client message ──────────────────────────────────────────
  // Reading a message and replying to one are different states. The queue needs to know
  // the coach hasn't replied, not that they opened the thread.
  if (snapshot.latestClientMessageAt) {
    const answered =
      snapshot.latestCoachReplyAt != null &&
      Date.parse(snapshot.latestCoachReplyAt) > Date.parse(snapshot.latestClientMessageAt);

    if (!answered) {
      const waiting = hoursBetween(snapshot.latestClientMessageAt, now);
      if (waiting >= MESSAGE_SLA_HOURS) {
        out.push({
          kind: "message_unanswered",
          severity: "critical",
          fingerprint: `msg:${snapshot.latestClientMessageId ?? snapshot.latestClientMessageAt}`,
          headline: `Waiting ${Math.floor(waiting / 24) >= 1 ? plural(Math.floor(waiting / 24), "day") : plural(Math.floor(waiting), "hour")} for a reply`,
          evidence: snapshot.latestClientMessagePreview
            ? `"${snapshot.latestClientMessagePreview}"`
            : "They messaged and haven't heard back.",
          action: "Reply",
          since: snapshot.latestClientMessageAt.slice(0, 10),
        });
      }
    }
  }

  // ── missed scheduled sessions ─────────────────────────────────────────────
  // Counted against what this client was actually scheduled to do, not against the
  // wall clock. "Four days quiet" fires constantly on a three-day-a-week program.
  const missed = schedule.adherence.missed;
  const behind = schedule.sessionsBehind;
  const missedCount = Math.max(missed, behind);
  if (missedCount >= MISSED_SESSIONS_HIGH) {
    out.push({
      kind: "sessions_missed",
      severity: missedCount >= MISSED_SESSIONS_CRITICAL ? "critical" : "high",
      fingerprint: `missed:${missedCount}`,
      headline: `${plural(missedCount, "session")} missed`,
      evidence:
        schedule.calendarWeek && schedule.totalWeeks
          ? `Week ${schedule.calendarWeek} of ${schedule.totalWeeks}, ${schedule.adherence.completed + schedule.adherence.scaled} of ${schedule.adherence.accountedFor} sessions done.`
          : `${plural(missedCount, "scheduled session")} haven't happened.`,
      action: "Check in with them",
      since: snapshot.lastActivityDate,
    });
  }

  // ── silence, for a client with nothing scheduled ──────────────────────────
  // Only when there's no assignment; otherwise missed sessions already covers it and
  // two signals for one condition is how a queue becomes noise.
  if (!snapshot.hasAssignment && snapshot.lastActivityDate) {
    const quiet = daysBetween(snapshot.lastActivityDate, today);
    if (quiet >= QUIET_DAYS_HIGH) {
      out.push({
        kind: "quiet",
        severity: quiet >= QUIET_DAYS_CRITICAL ? "critical" : "high",
        fingerprint: `quiet:${Math.floor(quiet / 7)}`,
        headline: `${plural(quiet, "day")} with no activity`,
        evidence: "No sessions, no habits, and no program assigned.",
        action: "Assign a program",
        since: snapshot.lastActivityDate,
      });
    }
  }

  // ── adherence on the floor ────────────────────────────────────────────────
  const weeksIn = engagement ? Math.floor(daysBetween(engagement.starts_on, today) / 7) + 1 : 0;
  if (
    schedule.adherence.pct != null &&
    schedule.adherence.pct < ADHERENCE_FLOOR_PCT &&
    weeksIn >= BASELINE_SUPPRESSION_WEEKS
  ) {
    out.push({
      kind: "adherence_low",
      severity: "high",
      // Bucketed to the nearest 10 so a drift from 41% to 39% isn't a "new" problem.
      fingerprint: `adherence:${Math.floor(schedule.adherence.pct / 10)}`,
      headline: `${schedule.adherence.pct}% adherence`,
      evidence: `${schedule.adherence.completed + schedule.adherence.scaled} of ${schedule.adherence.accountedFor} scheduled sessions done this block.`,
      action: "Review the program",
      since: null,
    });
  }

  // ── repeated scaling ──────────────────────────────────────────────────────
  // Not a discipline problem. Somebody scaling three sessions in a fortnight is telling
  // you something about their life, and the reasons they picked say what.
  if (snapshot.scaledRecently >= REPEATED_SCALING_COUNT) {
    const reasons = Array.from(new Set(snapshot.scalingReasons)).join(", ");
    out.push({
      kind: "repeated_scaling",
      severity: "high",
      fingerprint: `scaling:${snapshot.scaledRecently}`,
      headline: `Scaled ${plural(snapshot.scaledRecently, "session")} in ${REPEATED_SCALING_WINDOW_DAYS} days`,
      evidence: reasons ? `Reasons given: ${reasons}.` : "Rough Shift used repeatedly.",
      action: "Ask what's going on",
      since: null,
    });
  }

  // ── renewal and endings ───────────────────────────────────────────────────
  if (engagement?.ends_on && engagement.status === "active") {
    const daysLeft = daysBetween(today, engagement.ends_on);
    if (daysLeft < 0) {
      out.push({
        kind: "engagement_ended",
        severity: "opportunity",
        fingerprint: `ended:${engagement.id}`,
        headline: `Engagement ended ${plural(-daysLeft, "day")} ago`,
        evidence: "Still inside the read-only grace window — a renewal is still winnable.",
        action: "Offer the continuation rate",
        since: engagement.ends_on,
      });
    } else if (daysLeft <= RENEWAL_WINDOW_DAYS) {
      out.push({
        kind: "renewal_due",
        severity: "opportunity",
        fingerprint: `renewal:${engagement.id}`,
        headline: daysLeft === 0 ? "Engagement ends today" : `Ends in ${plural(daysLeft, "day")}`,
        evidence: `Started ${engagement.starts_on}. Renewal conversation is due now, not on the last day.`,
        action: "Start the renewal conversation",
        since: null,
      });
    }
  }

  return sortSignals(out);
}

/** Most urgent first; within a severity, the longest-standing problem leads. */
export function sortSignals(signals: CoachSignal[]): CoachSignal[] {
  return [...signals].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    if (a.since && b.since && a.since !== b.since) return a.since < b.since ? -1 : 1;
    if (a.since && !b.since) return -1;
    if (!a.since && b.since) return 1;
    return a.kind.localeCompare(b.kind);
  });
}

export interface SuppressedSignal {
  signal_kind: string;
  fingerprint: string;
  action: "snoozed" | "resolved";
  snoozed_until: string | null;
}

/**
 * Removes signals the coach has already dealt with.
 *
 * Matching on kind AND fingerprint is what lets a resolved condition come back when it
 * gets worse: resolving "2 sessions missed" leaves "5 sessions missed" free to surface.
 * A snooze expires on its date; a resolve stands until the fingerprint changes.
 */
export function applySuppressions(
  signals: CoachSignal[],
  suppressions: SuppressedSignal[],
  today: string,
): CoachSignal[] {
  return signals.filter((s) => {
    const match = suppressions.find(
      (x) => x.signal_kind === s.kind && x.fingerprint === s.fingerprint,
    );
    if (!match) return true;
    if (match.action === "resolved") return false;
    return match.snoozed_until != null && match.snoozed_until <= today;
  });
}

export interface QueueEntry {
  profileId: string;
  name: string;
  signals: CoachSignal[];
  topSeverity: Severity;
}

/**
 * The queue: one entry per client who needs something, ordered by their worst signal.
 *
 * Clients with nothing wrong are absent entirely. A list that includes everyone is a
 * client grid, and the coach already has one of those.
 */
export function buildQueue(
  entries: Array<{ snapshot: ClientSnapshot; suppressions: SuppressedSignal[] }>,
  now: string,
  today: string,
): QueueEntry[] {
  return entries
    .map(({ snapshot, suppressions }) => {
      const signals = applySuppressions(signalsFor(snapshot, now, today), suppressions, today);
      return {
        profileId: snapshot.profileId,
        name: snapshot.name,
        signals,
        topSeverity: (signals[0]?.severity ?? "opportunity") as Severity,
      };
    })
    .filter((e) => e.signals.length > 0)
    .sort((a, b) => {
      const bySeverity = SEVERITY_RANK[a.topSeverity] - SEVERITY_RANK[b.topSeverity];
      if (bySeverity !== 0) return bySeverity;
      if (a.signals.length !== b.signals.length) return b.signals.length - a.signals.length;
      return a.name.localeCompare(b.name);
    });
}
