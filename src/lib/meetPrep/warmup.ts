import { workingWeight } from "../trainingMax";

export interface WarmupSet {
  percent: number;
  reps: number;
  weight: number;
}

const WARMUP_RAMP: { percent: number; reps: number }[] = [
  { percent: 40, reps: 5 },
  { percent: 55, reps: 4 },
  { percent: 70, reps: 3 },
  { percent: 80, reps: 2 },
  { percent: 90, reps: 1 },
];

// Gradually approaches the opener without unnecessary fatigue. Computed on demand
// from the saved opener weight — not persisted or independently editable.
export function generateWarmup(openerWeight: number, increment: number): WarmupSet[] {
  return WARMUP_RAMP.map((s) => ({ ...s, weight: workingWeight(openerWeight, s.percent, increment) }));
}
