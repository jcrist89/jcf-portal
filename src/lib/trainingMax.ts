/** Working weight for a training max + percentage, rounded to the nearest increment (default 5 lb). */
export function workingWeight(trainingMax: number, percent: number, increment = 5): number {
  const raw = (trainingMax * percent) / 100;
  return Math.round(raw / increment) * increment;
}

/** 90%-of-1RM training max, rounded to the nearest increment (default 2.5, for kg). */
export function calculateTrainingMax(oneRepMax: number, tmPercent = 90, increment = 2.5): number {
  return Math.round((oneRepMax * tmPercent) / 100 / increment) * increment;
}

/**
 * Applies a hit/miss result to a lift's training max.
 * Hit bumps the training max ~4% (rounded to nearest 5 lb); miss holds it flat —
 * same rule as the original STD tracker.
 */
export function adjustTrainingMax(trainingMax: number, hit: boolean): number {
  if (!hit) return trainingMax;
  return Math.round((trainingMax * 1.04) / 5) * 5;
}
