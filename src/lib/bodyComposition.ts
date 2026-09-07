import type { Sex } from "@/lib/types";

export type BodyCompositionInput = {
  sex: Sex | null;
  heightIn: number | null;
  weightLb: number | null;
  waistIn: number | null;
  neckIn: number | null;
  hipsIn: number | null;
};

export type BodyCompositionEstimate = {
  bodyFatPercent: number;
  leanMassLb: number | null;
};

/**
 * U.S. Navy circumference method. It is an estimate, not a diagnostic measure,
 * and needs waist + neck for men or waist + neck + hips for women.
 */
export function estimateBodyComposition(input: BodyCompositionInput): BodyCompositionEstimate | null {
  const { sex, heightIn, weightLb, waistIn, neckIn, hipsIn } = input;
  if (!sex || !heightIn || !waistIn || !neckIn || heightIn <= 0 || waistIn <= neckIn) return null;

  const log10 = Math.log10;
  const raw = sex === "male"
    ? 86.010 * log10(waistIn - neckIn) - 70.041 * log10(heightIn) + 36.76
    : hipsIn && hipsIn > 0
      ? 163.205 * log10(waistIn + hipsIn - neckIn) - 97.684 * log10(heightIn) - 78.387
      : null;
  if (raw == null || !Number.isFinite(raw) || raw <= 0 || raw >= 80) return null;

  const bodyFatPercent = Math.round(raw * 10) / 10;
  return {
    bodyFatPercent,
    leanMassLb: weightLb && weightLb > 0 ? Math.round(weightLb * (1 - bodyFatPercent / 100) * 10) / 10 : null,
  };
}
