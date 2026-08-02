import { workingWeight } from "../trainingMax";
import { toLb, toKg } from "../units";

export interface AttemptSuggestion {
  opener: number;
  second: number;
  thirdConservative: number;
  thirdStandard: number;
  thirdAggressive: number;
}

// Opener ~88-92% of projected max, second ~96-101%, third options spanning
// conservative to aggressive above that — per the prompt's attempt-planner guidance.
export function suggestAttempts(projectedMax: number, increment: number): AttemptSuggestion {
  return {
    opener: workingWeight(projectedMax, 90, increment),
    second: workingWeight(projectedMax, 98, increment),
    thirdConservative: workingWeight(projectedMax, 100, increment),
    thirdStandard: workingWeight(projectedMax, 103, increment),
    thirdAggressive: workingWeight(projectedMax, 106, increment),
  };
}

export function kgToLb(kg: number): number {
  return Math.round(toLb(kg, "kg") * 10) / 10;
}

export function lbToKg(lb: number): number {
  return Math.round(toKg(lb, "lb") * 10) / 10;
}
