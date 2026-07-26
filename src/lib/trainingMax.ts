/** Working weight for a training max + percentage, rounded to the nearest 5 lb. */
export function workingWeight(trainingMax: number, percent: number): number {
  const raw = (trainingMax * percent) / 100;
  return Math.round(raw / 5) * 5;
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
