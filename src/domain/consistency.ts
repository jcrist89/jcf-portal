/**
 * Consistency rules. Pure — no Supabase, no Next, no React.
 *
 * The measure deliberately is NOT a consecutive-day streak. The client this is built
 * for is prone to all-or-nothing thinking, and a consecutive streak has exactly one
 * behaviour on a bad night: it dies, and takes the reason to keep going with it. A
 * rolling count of the last seven days can fall and recover. It never presents a single
 * missed day as a failure, and it cannot be "broken" — only lowered.
 */

export const HABIT_KEYS = ["protein", "steps", "water", "sleep"] as const;
export type HabitKey = (typeof HABIT_KEYS)[number];

/** Habits needed for a day to count. Three of four — perfection is not the bar. */
export const HABITS_FOR_A_GOOD_DAY = 3;

/** The window the rolling count is measured over. */
export const CONSISTENCY_WINDOW_DAYS = 7;

export interface HabitDay {
  local_date: string;
  protein: boolean;
  steps: boolean;
  water: boolean;
  sleep: boolean;
}

export interface Consistency {
  /** Successful days inside the window. The number shown to the client. */
  daysHit: number;
  /** Days in the window — 7 once an engagement is a week old, fewer before that. */
  windowDays: number;
  /** How many of the Big 4 are done today, 0-3+. */
  todayCount: number;
  /** Today already counts. */
  todayCounted: boolean;
  /** Consecutive successful days ending today. Shown only when it flatters. */
  runLength: number;
  /** Short phrase for the status strip. */
  label: string;
}

export function habitCount(day: Pick<HabitDay, HabitKey> | null | undefined): number {
  if (!day) return 0;
  return HABIT_KEYS.reduce((n, k) => n + (day[k] ? 1 : 0), 0);
}

export function isGoodDay(day: Pick<HabitDay, HabitKey> | null | undefined): boolean {
  return habitCount(day) >= HABITS_FOR_A_GOOD_DAY;
}

function isoDaysBefore(today: string, n: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Rolling consistency over the last `CONSISTENCY_WINDOW_DAYS`.
 *
 * `startedOn` shortens the window for a client who has not been going a full week, so a
 * three-day-old engagement reads "2 of 3 days" rather than "2 of 7" — which would look
 * like failure on day three and is the fastest way to lose someone in their first week.
 */
export function consistency(
  days: HabitDay[],
  today: string,
  startedOn?: string | null,
): Consistency {
  const byDate = new Map(days.map((d) => [d.local_date, d]));

  let windowDays = CONSISTENCY_WINDOW_DAYS;
  if (startedOn) {
    const elapsed =
      Math.round(
        (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startedOn}T00:00:00Z`)) / 86_400_000,
      ) + 1;
    windowDays = Math.max(1, Math.min(CONSISTENCY_WINDOW_DAYS, elapsed));
  }

  let daysHit = 0;
  for (let i = 0; i < windowDays; i++) {
    if (isGoodDay(byDate.get(isoDaysBefore(today, i)))) daysHit += 1;
  }

  // Counted back from today, and only while unbroken. Today not being finished yet does
  // not end a run — otherwise the number would collapse every morning.
  let runLength = 0;
  for (let i = isGoodDay(byDate.get(today)) ? 0 : 1; ; i++) {
    if (!isGoodDay(byDate.get(isoDaysBefore(today, i)))) break;
    runLength += 1;
    if (i > 400) break;
  }

  const todayCount = habitCount(byDate.get(today));

  return {
    daysHit,
    windowDays,
    todayCount,
    todayCounted: todayCount >= HABITS_FOR_A_GOOD_DAY,
    runLength,
    label: `${daysHit} of last ${windowDays}`,
  };
}

/**
 * What to say about today, given how many habits are done.
 *
 * Never scolds and never says "you failed". At two of four it names the one action that
 * would make the day count, because a specific next step is what an exhausted person can
 * act on; a general encouragement is not.
 */
export function todayHabitMessage(day: Pick<HabitDay, HabitKey> | null | undefined): string {
  const count = habitCount(day);
  if (count >= 4) return "All four. That's a big day.";
  if (count === 3) return "Three of four — today counts.";
  if (count === 2) return "One more and today counts.";
  if (count === 1) return "Good start. Two more makes it count.";
  return "Three of four makes today count.";
}
