import type { ExerciseLog, WorkoutLog } from "@/lib/types";
import { isHeavier } from "@/lib/units";

export function lastPerformanceFor(
  logs: WorkoutLog[],
  exerciseName: string,
  excludeLogId?: string
): { log: WorkoutLog; exercise: ExerciseLog } | null {
  for (const log of logs) {
    if (excludeLogId && log.id === excludeLogId) continue;
    if (!log.completed) continue;
    const match = log.exercises_completed.find((e) => e.name === exerciseName);
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
  exerciseName: string,
  excludeLogId?: string
): { weight: number; unit: "kg" | "lb"; reps: number; date: string } | null {
  let best: { weight: number; unit: "kg" | "lb"; reps: number; date: string } | null = null;
  for (const log of logs) {
    if (excludeLogId && log.id === excludeLogId) continue;
    if (!log.completed) continue;
    const match = log.exercises_completed.find((e) => e.name === exerciseName);
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
): Array<{ lift: string; weight: number; reps: number; unit: "kg" | "lb" }> {
  const out: Array<{ lift: string; weight: number; reps: number; unit: "kg" | "lb" }> = [];
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

    const priorBest = bestWeightForExercise(priorLogs, ex.name);
    // No prior best means this is the first time this exercise has ever been
    // logged for this client — that counts as a PR too, not just beating a number.
    if (!priorBest || isHeavier({ weight: sessionBest.weight, unit }, priorBest)) {
      out.push({ lift: ex.name, weight: sessionBest.weight, reps: sessionBest.reps, unit });
    }
  }
  return out;
}
