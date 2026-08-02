import { describe, it, expect } from "vitest";
import { checkJokerEligibility, jokerMaxPermittedWeight } from "./jokerEligibility";

const eligibleBase = {
  week: 6, // Intensification phase
  topSingleRpe: 7,
  readinessTier: "high" as const,
  priorWeekCompliance: 90,
  unresolvedDeviationsThisWeek: 0,
};

describe("checkJokerEligibility", () => {
  it("is eligible when every condition is met", () => {
    const { eligible, reasons } = checkJokerEligibility(eligibleBase);
    expect(eligible).toBe(true);
    expect(reasons).toEqual([]);
  });

  it("rejects outside the Intensification phase", () => {
    const { eligible, reasons } = checkJokerEligibility({ ...eligibleBase, week: 1 });
    expect(eligible).toBe(false);
    expect(reasons.join(" ")).toMatch(/Intensification/);
  });

  it("rejects a top single above RPE 7.5", () => {
    const { eligible, reasons } = checkJokerEligibility({ ...eligibleBase, topSingleRpe: 8 });
    expect(eligible).toBe(false);
    expect(reasons.join(" ")).toMatch(/RPE 7.5/);
  });

  it("rejects low or very_low readiness", () => {
    expect(checkJokerEligibility({ ...eligibleBase, readinessTier: "low" }).eligible).toBe(false);
    expect(checkJokerEligibility({ ...eligibleBase, readinessTier: "very_low" }).eligible).toBe(false);
  });

  it("requires a completed readiness check-in for today", () => {
    const { eligible, reasons } = checkJokerEligibility({ ...eligibleBase, readinessTier: null });
    expect(eligible).toBe(false);
    expect(reasons.join(" ")).toMatch(/readiness check-in/);
  });

  it("rejects with any unresolved deviation this week", () => {
    const { eligible } = checkJokerEligibility({ ...eligibleBase, unresolvedDeviationsThisWeek: 1 });
    expect(eligible).toBe(false);
  });

  it("rejects when prior week compliance was below 85%", () => {
    const { eligible, reasons } = checkJokerEligibility({ ...eligibleBase, priorWeekCompliance: 84 });
    expect(eligible).toBe(false);
    expect(reasons.join(" ")).toMatch(/85%/);
  });

  it("allows a null prior-week compliance (no prior week to judge)", () => {
    const { eligible } = checkJokerEligibility({ ...eligibleBase, priorWeekCompliance: null });
    expect(eligible).toBe(true);
  });

  it("accumulates every failing reason at once, not just the first", () => {
    const { reasons } = checkJokerEligibility({
      week: 1,
      topSingleRpe: 9,
      readinessTier: "low",
      priorWeekCompliance: 50,
      unresolvedDeviationsThisWeek: 2,
    });
    expect(reasons.length).toBeGreaterThanOrEqual(4);
  });
});

describe("jokerMaxPermittedWeight", () => {
  it("caps at 2.5% over the top single, rounded to the increment", () => {
    // 315 * 1.025 = 322.875, rounded to nearest 5 -> 325
    expect(jokerMaxPermittedWeight(315, 5)).toBe(325);
  });
});
