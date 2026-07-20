import type { Program, ProgramDay } from "@/lib/types";

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

/** Given how many workouts have been completed against this program, find the next day up. */
export function nextDayUp(program: Program | null, completedCount: number): FlatDay | null {
  const flat = flattenProgram(program);
  if (flat.length === 0) return null;
  return flat[completedCount % flat.length];
}
