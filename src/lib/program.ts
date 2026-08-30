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
