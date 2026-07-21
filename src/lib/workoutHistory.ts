import type { ExerciseLog, WorkoutLog } from "@/lib/types";

/**
 * Finds the most recent logged performance of a given exercise (by name) across
 * a client's full workout history. `logs` is expected to already be sorted most
 * recent first (date descending), which is how it's fetched everywhere in the app.
 * This is what makes progression possible — "last time you did Back Squat" —
 * regardless of which week/day it was logged under.
 */
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

/** Compact human-readable summary of a set list, e.g. "185x5, 185x5, 190x4". */
export function formatSets(exercise: ExerciseLog): string {
  return exercise.sets
    .filter((s) => s.weight != null || s.reps != null)
    .map((s) => {
      const parts = [];
      if (s.weight != null) parts.push(`${s.weight}`);
      if (s.reps != null) parts.push(`x${s.reps}`);
      const base = parts.join("");
      return s.rpe != null ? `${base} @${s.rpe}` : base;
    })
    .join(", ");
}

/**
 * Best-ever weight recorded for a given exercise across a set of completed logs
 * (ties broken by higher reps, then most recent). Returns null if the exercise
 * has never been logged with a valid weight before.
 */
export function bestWeightForExercise(
  logs: WorkoutLog[],
  exerciseName: string,
  excludeLogId?: string
): { weight: number; reps: number; date: string } | null {
  let best: { weight: number; reps: number; date: string } | null = null;
  for (const log of logs) {
    if (excludeLogId && log.id === excludeLogId) continue;
    if (!log.completed) continue;
    const match = log.exercises_completed.find((e) => e.name === exerciseName);
    if (!match) continue;
    for (const s of match.sets) {
      if (s.weight == null || s.weight <= 0) continue;
      const reps = s.reps ?? 0;
      if (!best || s.weight > best.weight || (s.weight === best.weight && reps > best.reps)) {
        best = { weight: s.weight, reps, date: log.date };
      }
    }
  }
  return best;
}

/**
 * Auto-PR detection: compares the exercises from a workout that's about to be
 * saved against the client's prior logged history (excluding this workout) and
 * returns one candidate per exercise that set a new all-time-best weight.
 * This is what lets the app record PRs automatically at log time instead of
 * requiring a separate manual "Log New PR" entry.
 */
export function detectNewPRs(
  priorLogs: WorkoutLog[],
  justLoggedExercises: ExerciseLog[]
): Array<{ lift: string; weight: number; reps: number }> {
  const out: Array<{ lift: string; weight: number; reps: number }> = [];
  for (const ex of justLoggedExercises) {
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
    if (!priorBest || sessionBest.weight > priorBest.weight) {
      out.push({ lift: ex.name, weight: sessionBest.weight, reps: sessionBest.reps });
    }
  }
  return out;
}
