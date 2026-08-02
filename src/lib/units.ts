/**
 * Canonical unit handling for weights across the app.
 *
 * Model: every stored weight keeps the value and unit it was originally entered
 * in (`prs.unit`, `training_maxes.unit`, `ExerciseLog.unit` — never silently
 * rewritten). Whenever two weights need to be *compared or summed* (PR
 * best-of, achievement totals, chart series), convert both to the canonical
 * internal unit (lb — matches every existing default in the schema) first.
 * Display always uses the value's own original unit, converting only the
 * canonical-unit comparison result back for presentation when needed.
 */

export type WeightUnit = "kg" | "lb";

const KG_PER_LB = 0.45359237;

/** Convert a weight to pounds. No-ops if already lb. */
export function toLb(weight: number, unit: WeightUnit): number {
  return unit === "kg" ? weight / KG_PER_LB : weight;
}

/** Convert a weight to kilograms. No-ops if already kg. */
export function toKg(weight: number, unit: WeightUnit): number {
  return unit === "lb" ? weight * KG_PER_LB : weight;
}

/** Round to the nearest increment (5 lb / 2.5 kg by convention elsewhere in the app). */
export function roundToIncrement(weight: number, increment: number): number {
  return Math.round(weight / increment) * increment;
}

/** Default rounding increment for a unit, matching the convention used throughout
 *  training-max and attempt-plan math (nearest 5 lb, nearest 2.5 kg). */
export function defaultIncrement(unit: WeightUnit): number {
  return unit === "kg" ? 2.5 : 5;
}

/** True if `a` is strictly heavier than `b`, comparing in a common unit rather
 *  than raw numbers — the only safe way to compare two weights that might have
 *  been entered in different units. */
export function isHeavier(a: { weight: number; unit: WeightUnit }, b: { weight: number; unit: WeightUnit }): boolean {
  return toLb(a.weight, a.unit) > toLb(b.weight, b.unit);
}

/** Sums a list of {weight, unit} entries, all converted to lb first. */
export function sumInLb(entries: Array<{ weight: number; unit: WeightUnit }>): number {
  return entries.reduce((total, e) => total + toLb(e.weight, e.unit), 0);
}

/** Displays a weight rounded to 1 decimal in its own unit — for chart series/labels
 *  where every point needs to be on the same axis regardless of how it was entered. */
export function convertForDisplay(weight: number, fromUnit: WeightUnit, toUnit: WeightUnit): number {
  const lb = toLb(weight, fromUnit);
  const converted = toUnit === "kg" ? toKg(lb, "lb") : lb;
  return Math.round(converted * 10) / 10;
}
