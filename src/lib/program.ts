import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import type { Program, ProgramDay } from "@/lib/types";
import { localDateIn } from "@/lib/localDate";

export interface FlatDay extends ProgramDay {
  week: number;
  weekNote?: string;
  index: number;
}

/** Flattens a program's week/day structure into a single sequential list. */
export function flattenProgram(program: Program | null): FlatDay[] {
  if (!program) return [];
  const out: FlatDay[] = [];
  let index = 0;
  for (const week of program.structure.weeks ?? []) {
    for (const day of week.days ?? []) {
      out.push({ ...day, week: week.week, weekNote: week.note, index });
      index += 1;
    }
  }
  return out;
}

/** The slice of a workout log this calculation needs. */
export interface SessionLog {
  date: string;
  completed: boolean;
  program_id: string | null;
}

export interface ProgramPosition {
  /** The session to serve next, or null when there's nothing due. */
  day: FlatDay | null;
  /** Index into the flattened program, or -1 when there's nothing to serve. */
  index: number;
  /** 1-based calendar week of the block. Null when the program has no start date. */
  calendarWeek: number | null;
  /** Weeks in the block, for "week 6 of 12". */
  totalWeeks: number;
  /** True once every prescribed session has been completed. */
  complete: boolean;
  /** Sequential mode only: sessions the calendar expected that haven't happened. */
  sessionsBehind: number;
}

const EMPTY: ProgramPosition = {
  day: null,
  index: -1,
  calendarWeek: null,
  totalWeeks: 0,
  complete: false,
  sessionsBehind: 0,
};

/**
 * Where a client actually is in their block.
 *
 * Replaces the previous `completedCount % totalDays`, which had two failures: it
 * silently restarted the program at week 1 once the client ran past the end, and it
 * had no notion of the calendar at all — so "what week is this client in?" was
 * unanswerable and a peaking block could drift arbitrarily far behind its meet date.
 *
 * Two modes, matching programs.schedule_mode:
 *
 *   sequential    Serve the next undone session; a missed one simply waits. Correct
 *                 for a client training around a rotating shift — miss Tuesday, do it
 *                 Thursday, nothing is lost. The calendar is used only to report how
 *                 far behind the block they've fallen.
 *
 *   date_anchored Follow the calendar and let a missed session go. The only correct
 *                 behaviour for a block whose taper has to land on a fixed
 *                 competition date; queuing missed sessions guarantees it won't.
 *
 * Takes the client's whole workout log and scopes it to THIS program itself, rather
 * than trusting each caller to pre-filter. Counting every log the client ever wrote
 * would carry work done in an earlier block into a new one — assign a fresh block to
 * someone with three sessions behind them and they'd open it on session four.
 * Comparisons are on ISO date strings, which sort correctly and sidestep timezone drift.
 */
export function programPosition(
  program: Program | null,
  logs: SessionLog[],
  now: Date = new Date(),
  timezone = "UTC",
): ProgramPosition {
  const flat = flattenProgram(program);
  if (!program || flat.length === 0) return EMPTY;

  const completedDates = logs
    .filter((l) => l.completed && l.program_id === program.id)
    .map((l) => l.date);

  const totalWeeks = program.structure.weeks?.length ?? 0;
  const completedCount = completedDates.length;
  const startsOn = program.starts_on ?? null;

  const calendarWeek = startsOn
    ? Math.max(1, Math.floor(differenceInCalendarDays(now, parseISO(startsOn)) / 7) + 1)
    : null;

  if (program.schedule_mode === "date_anchored" && startsOn && totalWeeks > 0) {
    // Past the end of the block: nothing further is prescribed.
    if (calendarWeek! > totalWeeks) {
      return { day: null, index: -1, calendarWeek, totalWeeks, complete: true, sessionsBehind: 0 };
    }

    const daysThisWeek = flat.filter((d) => d.week === calendarWeek);
    const weekStart = addDays(parseISO(startsOn), (calendarWeek! - 1) * 7);
    const weekStartStr = localDateIn(timezone, weekStart);
    const weekEndStr = localDateIn(timezone, addDays(weekStart, 7));
    const doneThisWeek = completedDates.filter((d) => d >= weekStartStr && d < weekEndStr).length;

    // Everything scheduled for this calendar week is done — rest, don't pull work forward.
    const day = daysThisWeek[doneThisWeek] ?? null;
    return {
      day,
      index: day?.index ?? -1,
      calendarWeek,
      totalWeeks,
      complete: false,
      sessionsBehind: 0,
    };
  }

  // Sequential.
  if (completedCount >= flat.length) {
    return { day: null, index: -1, calendarWeek, totalWeeks, complete: true, sessionsBehind: 0 };
  }

  const expectedByNow = calendarWeek
    ? flat.filter((d) => d.week <= calendarWeek).length
    : completedCount;

  return {
    day: flat[completedCount],
    index: completedCount,
    calendarWeek,
    totalWeeks,
    complete: false,
    sessionsBehind: Math.max(0, Math.min(expectedByNow, flat.length) - completedCount),
  };
}
