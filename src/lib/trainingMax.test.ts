import { describe, it, expect } from "vitest";
import { adjustTrainingMax, calculateTrainingMax, workingWeight } from "./trainingMax";

describe("workingWeight", () => {
  it("rounds to the nearest 5 lb by default", () => {
    expect(workingWeight(300, 87)).toBe(260); // 261 -> nearest 5 = 260
  });
  it("rounds to a custom increment (kg)", () => {
    expect(workingWeight(140, 90, 2.5)).toBe(125); // 126 -> nearest 2.5 = 125
  });
});

describe("calculateTrainingMax", () => {
  it("defaults to 90% of 1RM rounded to 2.5", () => {
    expect(calculateTrainingMax(200)).toBe(180);
  });
});

describe("adjustTrainingMax", () => {
  it("holds the training max flat on a miss", () => {
    expect(adjustTrainingMax(315, false)).toBe(315);
  });

  it("bumps ~4% on a hit, rounded to the nearest 5", () => {
    // 315 * 1.04 = 327.6 -> nearest 5 = 330
    expect(adjustTrainingMax(315, true)).toBe(330);
  });

  it("never decreases the training max on a hit", () => {
    const bumped = adjustTrainingMax(200, true);
    expect(bumped).toBeGreaterThanOrEqual(200);
  });
});
