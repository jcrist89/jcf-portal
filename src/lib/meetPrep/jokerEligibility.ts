import { phaseForWeek } from "./generateProgram";
import { workingWeight } from "../trainingMax";

export interface JokerEligibilityInput {
  week: number;
  topSingleRpe: number;
  readinessTier: "high" | "moderate" | "low" | "very_low" | null;
  priorWeekCompliance: number | null; // null = no prior week to judge (e.g. week 5)
  unresolvedDeviationsThisWeek: number;
}

export interface JokerEligibilityResult {
  eligible: boolean;
  reasons: string[];
}

// Per the prompt's joker-set rules: only during Intensification, only off a clean
// top single, only with acceptable readiness, and only with a clean recent record.
export function checkJokerEligibility(input: JokerEligibilityInput): JokerEligibilityResult {
  const reasons: string[] = [];
  const phase = phaseForWeek(input.week);

  if (!phase || !phase.startsWith("Intensification")) {
    reasons.push("Joker sets are only available during the Intensification phase (weeks 5-8).");
  }
  if (input.topSingleRpe > 7.5) {
    reasons.push("Top single must be at or below RPE 7.5 to earn a joker set.");
  }
  if (input.readinessTier === "low" || input.readinessTier === "very_low") {
    reasons.push("Readiness is too low today for a joker set.");
  }
  if (input.readinessTier == null) {
    reasons.push("Complete today's readiness check-in first.");
  }
  if (input.unresolvedDeviationsThisWeek > 0) {
    reasons.push("An unreviewed deviation this week removes joker eligibility.");
  }
  if (input.priorWeekCompliance != null && input.priorWeekCompliance < 85) {
    reasons.push("Last week's compliance was below 85% — no joker set this week.");
  }

  return { eligible: reasons.length === 0, reasons };
}

// +2.5% over the top single, rounded to the lift's increment — the default ceiling
// from the prompt's "no more than 2.5-5%" rule. Coach can override on approval.
export function jokerMaxPermittedWeight(topSingleWeight: number, increment: number): number {
  return workingWeight(topSingleWeight, 102.5, increment);
}
