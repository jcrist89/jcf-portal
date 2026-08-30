import type { ExerciseLog, WorkoutLog } from "@/lib/types";
import { isHeavier } from "@/lib/units";

/**
 * Anything that can identify an exercise: a prescribed program entry, a logged entry,
 * or a bare catalog row. `exerciseId` is the real identity; `name` is the fallback for
 * data written before the catalog existed.
 */
export interface ExerciseRef {
  name: string;
  exerciseId?: string;
}

/**
 * Whether two entries refer to the same movement.
 *
 * History used to be joined on the display name alone, so renaming "Bench Press" to
 * "Competition Bench Press" in the builder silently disconnected every prior
 * performance, every inline "last time" hint and every PR for that lift. Matching on
 * exerciseId makes the name free to change.
 *
 * The name comparison remains only as a fallback for entries written before the catalog
 * existed. Once both sides carry an id, the id is decisive — two entries with different
 * ids are different exercises even if a coach has given them the same name.
 */
export function sameExercise(a: ExerciseRef, b: ExerciseRef): boolean {
  if (a.exerciseId && b.exerciseId) return a.exerciseId === b.exerciseId;
  return a.name === b.name;
}

export function lastPerformanceFor(
  logs: WorkoutLog[],
  exercise: ExerciseRef,
  excludeLogId?: string
): { log: WorkoutLog; exercise: ExerciseLog } | null {
  for (const log of logs) {
    if (excludeLogId && log.id === excludeLogId) continue;
    if (!log.completed) continue;
    const match = log.exercises_completed.find((e) => sameExercise(e, exercise));
    if (match && match.sets.some((s) => s.weight != null || s.reps != null)) {
      return { log, exercise: match };
    }
  }
  return null;
}

export function formatSets(exercise: ExerciseLog): string {
  const hasWeight = exercise.sets.some((s) => s.weight != null);
  const formatted = exercise.sets
    .filter((s) => s.weight != null || s.reps != null)
    .map((s) => {
      const parts = [];
      if (s.weight != null) parts.push(`${s.weight}`);
      if (s.reps != null) parts.push(`x${s.reps}`);
      const base = parts.join("");
      return s.rpe != null ? `${base} @${s.rpe}` : base;
    })
    .join(", ");
  // Unit is one per exercise entry (not per set), so it's shown once at the end
  // rather than repeated after every weight.
  return hasWeight && formatted ? `${formatted} ${exercise.unit ?? "lb"}` : formatted;
}

export function bestWeightForExercise(
  logs: WorkoutLog[],
  exercise: ExerciseRef,
  excludeLogId?: string
): { weight: number; unit: "kg" | "lb"; reps: number; date: string } | null {
  let best: { weight: number; unit: "kg" | "lb"; reps: number; date: string } | null = null;
  for (const log of logs) {
    if (excludeLogId && log.id === excludeLogId) continue;
    if (!log.completed) continue;
    const match = log.exercises_completed.find((e) => sameExercise(e, exercise));
    if (!match) continue;
    const unit = match.unit ?? "lb";
    for (const s of match.sets) {
      if (s.weight == null || s.weight <= 0) continue;
      const reps = s.reps ?? 0;
      const candidate = { weight: s.weight, unit, reps, date: log.date };
      // Compare in a common unit (isHeavier converts both sides) — a raw number
      // comparison would be wrong whenever this exercise has ever been logged in
      // both kg and lb (e.g. meet_bench tracked in kg some sessions, lb others).
      if (!best || isHeavier(candidate, best) || (candidate.weight === best.weight && candidate.unit === best.unit && reps > best.reps)) {
        best = candidate;
      }
    }
  }
  return best;
}

export function detectNewPRs(
  priorLogs: WorkoutLog[],
  justLoggedExercises: ExerciseLog[]
): Array<{ lift: string; exerciseId?: string; weight: number; reps: number; unit: "kg" | "lb" }> {
  const out: Array<{ lift: string; exerciseId?: string; weight: number; reps: number; unit: "kg" | "lb" }> = [];
  for (const ex of justLoggedExercises) {
    const unit = ex.unit ?? "lb";
    let sessionBest: { weight: number; reps: number } | null = null;
    for (const s of ex.sets) {
      if (s.weight == null || s.weight <= 0) continue;
      const reps = s.reps ?? 0;
      if (!sessionBest || s.weight > sessionBest.weight || (s.weight === sessionBest.weight && reps > sessionBest.reps)) {
        sessionBest = { weight: s.weight, reps };
      }
    }
    if (!sessionBest) continue;

    const priorBest = bestWeightForExercise(priorLogs, ex);
    // No prior best means this is the first time this exercise has ever been
    // logged for this client — that counts as a PR too, not just beating a number.
    //
    // NOTE: this is why there are 79 PR rows against 23 workouts — a fresh block mints
    // one per new exercise. Worth changing, but it alters what the client sees and what
    // lands in `prs`, so it is left as-is here rather than smuggled into an identity fix.
    if (!priorBest || isHeavier({ weight: sessionBest.weight, unit }, priorBest)) {
      out.push({
        lift: ex.name,
        exerciseId: ex.exerciseId,
        weight: sessionBest.weight,
        reps: sessionBest.reps,
        unit,
      });
    }
  }
  return out;
}
