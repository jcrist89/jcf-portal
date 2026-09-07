import type { Exercise, WorkoutLog } from "@/lib/types";
import { convertForDisplay, defaultIncrement, roundToIncrement, type WeightUnit } from "@/lib/units";
import { lastPerformanceFor } from "@/lib/workoutHistory";

export interface ProgressionRecommendation {
  weight: number | null;
  unit: WeightUnit;
  progressed: boolean;
  reason: string;
}

export interface WarmupSet {
  weight: number;
  reps: number;
}

/** The top end of a prescription such as "8-12". Timed and distance work is excluded. */
export function maxRepTarget(reps: string): number | null {
  if (/\b(sec|second|min|minute|yd|yard|mile|km)\b/i.test(reps)) return null;
  const values = Array.from(reps.matchAll(/\d+(?:\.\d+)?/g), (match) => Number(match[0]));
  return values.length ? Math.max(...values) : null;
}

/** Accepts normal program entries such as "90 sec", "2 min", and "2-3 min". */
export function parseRestSeconds(rest: string): number | null {
  const match = rest.toLowerCase().match(/(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(sec(?:ond)?s?|min(?:ute)?s?)/);
  if (!match) return null;
  // For a range, use the upper end so the timer does not cut recovery short.
  const amount = Number(match[2] ?? match[1]);
  return Math.round(amount * (match[3].startsWith("m") ? 60 : 1));
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes}:${String(remainder).padStart(2, "0")}` : `0:${String(remainder).padStart(2, "0")}`;
}

/**
 * Recommend the next straight-set load from the latest completed matching exercise.
 * A 5% increase is earned only when every prescribed set was logged at the upper end
 * of the rep range. Mixed ramping weights deliberately receive no auto-load so a coach
 * or client can make the call rather than applying 5% to the wrong set.
 */
export function progressionRecommendation(
  history: WorkoutLog[],
  exercise: Exercise,
): ProgressionRecommendation {
  const last = lastPerformanceFor(history, exercise);
  const unit = exercise.unit ?? last?.exercise.unit ?? "lb";
  if (!last) return { weight: null, unit, progressed: false, reason: "Log this movement once to unlock a recommendation." };

  const prescribedSets = typeof exercise.sets === "number"
    ? exercise.sets
    : parseInt(String(exercise.sets), 10) || 1;
  const workingSets = last.exercise.sets.slice(0, prescribedSets);
  const maxReps = maxRepTarget(exercise.reps);
  if (!maxReps || workingSets.length < prescribedSets || workingSets.some((set) => set.weight == null || set.reps == null)) {
    return { weight: null, unit, progressed: false, reason: "Complete every prescribed set to unlock a recommendation." };
  }

  const lastUnit = last.exercise.unit ?? "lb";
  const weights = workingSets.map((set) => convertForDisplay(set.weight!, lastUnit, unit));
  const baseWeight = weights[0];
  if (weights.some((weight) => Math.abs(weight - baseWeight) > 0.01)) {
    return { weight: null, unit, progressed: false, reason: "Last session used ramping weights — choose today’s load manually." };
  }

  const allAtTopRange = workingSets.every((set) => set.reps! >= maxReps);
  const increment = defaultIncrement(unit);
  if (allAtTopRange) {
    const next = roundToIncrement(baseWeight * 1.05, increment);
    return { weight: next, unit, progressed: true, reason: `All ${prescribedSets} sets reached ${maxReps} reps — add 5%.` };
  }

  return {
    weight: roundToIncrement(baseWeight, increment),
    unit,
    progressed: false,
    reason: `Hold the load until every set reaches ${maxReps} reps.`,
  };
}

/** Three quick ramp sets for a weighted working movement. */
export function warmupSets(workingWeight: number | null, unit: WeightUnit): WarmupSet[] {
  if (workingWeight == null || workingWeight <= 0) return [];
  const increment = defaultIncrement(unit);
  const fractions: Array<[number, number]> = workingWeight <= increment * 6
    ? [[0.5, 8], [0.75, 4]]
    : [[0.4, 8], [0.6, 5], [0.8, 3]];
  return fractions.map(([fraction, reps]) => ({
    weight: Math.max(increment, roundToIncrement(workingWeight * fraction, increment)),
    reps,
  }));
}
