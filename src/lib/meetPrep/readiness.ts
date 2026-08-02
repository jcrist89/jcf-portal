import type { ReadinessTier } from "../types";

export interface ReadinessFields {
  sleep: number;
  fatigue: number;
  soreness: number;
  jointPain: number;
  stress: number;
  motivation: number;
  nutrition: number;
  confidence: number;
}

export interface ReadinessResult {
  score: number;
  tier: ReadinessTier;
}

// Each field is reported 1-5 at face value (e.g. Joint Pain: 1 = none, 5 = a lot).
// sleep/motivation/nutrition/confidence are "higher = better" and count directly;
// fatigue/soreness/joint_pain/stress are "higher = worse" and get inverted (6-x)
// before summing, so a bad session (high fatigue/pain/stress) always pulls the
// score down rather than up. Sum ranges 8-40, scaled to a 20-100 score. Meaningful
// pain (joint_pain >= 4 at face value) forces very_low regardless of the overall
// score, per the "Very Low Readiness or Meaningful Pain" tier.
export function scoreReadiness(fields: ReadinessFields): ReadinessResult {
  const sum =
    fields.sleep +
    (6 - fields.fatigue) +
    (6 - fields.soreness) +
    (6 - fields.jointPain) +
    (6 - fields.stress) +
    fields.motivation +
    fields.nutrition +
    fields.confidence;
  const score = Math.round((sum / 40) * 100);

  let tier: ReadinessTier;
  if (fields.jointPain >= 4) tier = "very_low";
  else if (score >= 80) tier = "high";
  else if (score >= 60) tier = "moderate";
  else if (score >= 40) tier = "low";
  else tier = "very_low";

  return { score, tier };
}
