/**
 * Weekly check-in lifecycle. Pure — no Supabase, no Next, no React.
 *
 * The check-in is the artifact the entire coaching loop hangs from, and in six weeks of
 * production it has been used three times. So the rules here optimise for one thing:
 * making it obvious when one is owed, and making the coach's half of the exchange
 * measurable. Knowing a check-in exists is worthless; knowing nobody has answered it is
 * the whole point.
 *
 * Status is DERIVED from timestamps, never stored. A stored status is a state machine
 * that can disagree with its own timestamps, and there is no third party to arbitrate.
 *
 * Due dates are derived too, rather than materialized like sessions. A check-in that was
 * never submitted has no row — so "overdue" has to be answerable without one.
 */

import type { Engagement } from "@/domain/engagement";

export type CheckinStatus =
  | "upcoming"
  | "due"
  | "overdue"
  | "submitted"
  | "reviewed"
  | "responded";

/** Grace before an unsubmitted check-in is treated as overdue. */
export const OVERDUE_AFTER_DAYS = 1;

/** How long the coach has to respond before the queue calls it out. */
export const RESPONSE_SLA_HOURS = 48;

export interface Checkin {
  id: string;
  profile_id: string;
  due_local_date: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  coach_responded_at: string | null;
  weight: number | null;
  waist: number | null;
  sleep_avg: number | null;
  night_shifts: number | null;
  steps_avg: number | null;
  nutrition_adherence: number | null;
  protein_days: number | null;
  alcohol_drinks: number | null;
  energy: number | null;
  stress: number | null;
  win: string | null;
  struggle: string | null;
  ask: string | null;
  coach_response: string | null;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Day of week for an ISO date, 0 = Sunday. */
function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/**
 * The check-in currently in play: the most recent one that has come due on or before
 * `today`. Before the first one ever falls due, this is the upcoming date instead.
 */
export function currentCheckinDate(engagement: Engagement | null, today: string): string | null {
  if (!engagement) return null;

  const startWeekday = weekdayOf(engagement.starts_on);
  const offsetToFirst = (engagement.checkin_weekday - startWeekday + 7) % 7;
  const first = shiftDate(engagement.starts_on, offsetToFirst);

  if (today < first) return first;

  const weeksSince = Math.floor(daysBetween(first, today) / 7);
  return shiftDate(first, weeksSince * 7);
}

/** The next check-in date on or after `today`. */
export function nextCheckinDate(engagement: Engagement | null, today: string): string | null {
  const current = currentCheckinDate(engagement, today);
  if (!current) return null;
  return current >= today ? current : shiftDate(current, 7);
}

/**
 * Where a check-in stands.
 *
 * `checkin` may be null — an unsubmitted check-in has no row, which is exactly the case
 * the coach most needs surfaced.
 */
export function checkinStatus(
  checkin: Pick<Checkin, "submitted_at" | "reviewed_at" | "coach_responded_at"> | null,
  dueOn: string | null,
  today: string,
): CheckinStatus {
  if (checkin?.coach_responded_at) return "responded";
  if (checkin?.reviewed_at) return "reviewed";
  if (checkin?.submitted_at) return "submitted";

  if (!dueOn) return "upcoming";
  if (dueOn > today) return "upcoming";
  if (daysBetween(dueOn, today) > OVERDUE_AFTER_DAYS) return "overdue";
  return "due";
}

export interface CheckinState {
  dueOn: string | null;
  status: CheckinStatus;
  /** Days past due. 0 when not overdue. */
  daysOverdue: number;
  /** Hours the coach has left it sitting unanswered since submission. */
  hoursAwaitingResponse: number | null;
  /** Past the response SLA with no reply. */
  responseOverdue: boolean;
}

export function checkinState(
  engagement: Engagement | null,
  checkin: Checkin | null,
  today: string,
  now: string,
): CheckinState {
  const dueOn = currentCheckinDate(engagement, today);
  const status = checkinStatus(checkin, dueOn, today);

  const daysOverdue = status === "overdue" && dueOn ? daysBetween(dueOn, today) : 0;

  let hoursAwaitingResponse: number | null = null;
  if (checkin?.submitted_at && !checkin.coach_responded_at) {
    hoursAwaitingResponse = Math.floor(
      (Date.parse(now) - Date.parse(checkin.submitted_at)) / 3_600_000,
    );
  }

  return {
    dueOn,
    status,
    daysOverdue,
    hoursAwaitingResponse,
    responseOverdue: (hoursAwaitingResponse ?? 0) >= RESPONSE_SLA_HOURS,
  };
}

export interface TrendedField {
  key: string;
  label: string;
  current: number | null;
  previous: number | null;
  /** Positive means the number went up, whatever that means for this field. */
  delta: number | null;
  /** True when the change is worth the coach's eye. */
  notable: boolean;
}

/** Change large enough to be worth highlighting, per field. */
const NOTABLE_DELTA: Record<string, number> = {
  weight: 2,
  waist: 0.5,
  sleep_avg: 1,
  night_shifts: 2,
  steps_avg: 2000,
  nutrition_adherence: 2,
  protein_days: 2,
  alcohol_drinks: 3,
  energy: 2,
  stress: 2,
};

const FIELD_LABELS: Record<string, string> = {
  weight: "Weight",
  waist: "Waist",
  sleep_avg: "Sleep",
  night_shifts: "Night shifts",
  steps_avg: "Steps",
  nutrition_adherence: "Nutrition",
  protein_days: "Protein days",
  alcohol_drinks: "Drinks",
  energy: "Energy",
  stress: "Stress",
};

/**
 * This week beside last week, with the changes worth looking at marked.
 *
 * The coach has roughly eight minutes per client. Handing them twenty numbers and
 * expecting them to spot the two that moved is how eight minutes becomes twenty.
 */
export function compareCheckins(current: Checkin, previous: Checkin | null): TrendedField[] {
  return Object.keys(FIELD_LABELS).map((key) => {
    const a = current[key as keyof Checkin] as number | null;
    const b = (previous?.[key as keyof Checkin] ?? null) as number | null;
    const delta = a != null && b != null ? Number((a - b).toFixed(2)) : null;
    return {
      key,
      label: FIELD_LABELS[key],
      current: a,
      previous: b,
      delta,
      notable: delta != null && Math.abs(delta) >= (NOTABLE_DELTA[key] ?? Infinity),
    };
  });
}
