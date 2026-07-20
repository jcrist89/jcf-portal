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
