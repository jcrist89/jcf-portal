import type { ExerciseLog, WorkoutLog } from "@/lib/types";

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
    // No prior best means this is the first time this exercise has ever been
    // logged for this client — that counts as a PR too, not just beating a number.
    if (!priorBest || sessionBest.weight > priorBest.weight) {
      out.push({ lift: ex.name, weight: sessionBest.weight, reps: sessionBest.reps });
    }
  }
  return out;
}
