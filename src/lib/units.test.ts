import { describe, it, expect } from "vitest";
import { toLb, toKg, isHeavier, sumInLb, roundToIncrement, convertForDisplay } from "./units";

describe("toLb / toKg", () => {
  it("round-trips kg -> lb -> kg within rounding tolerance", () => {
    const kg = 140;
    const lb = toLb(kg, "kg");
    expect(lb).toBeCloseTo(308.6, 0);
    expect(toKg(lb, "lb")).toBeCloseTo(kg, 5);
  });

  it("is a no-op when already in the target unit", () => {
    expect(toLb(225, "lb")).toBe(225);
    expect(toKg(100, "kg")).toBe(100);
  });
});

describe("isHeavier", () => {
  it("correctly ranks a kg weight against a lb weight", () => {
    // 100 kg (~220 lb) is heavier than 200 lb, even though 100 < 200 raw
    expect(isHeavier({ weight: 100, unit: "kg" }, { weight: 200, unit: "lb" })).toBe(true);
  });

  it("returns false when the comparison weight is actually lighter", () => {
    // 90 kg (~198 lb) is lighter than 200 lb
    expect(isHeavier({ weight: 90, unit: "kg" }, { weight: 200, unit: "lb" })).toBe(false);
  });

  it("compares correctly within the same unit", () => {
    expect(isHeavier({ weight: 315, unit: "lb" }, { weight: 300, unit: "lb" })).toBe(true);
    expect(isHeavier({ weight: 300, unit: "lb" }, { weight: 315, unit: "lb" })).toBe(false);
  });
});

describe("sumInLb", () => {
  it("sums mixed-unit entries in a common unit", () => {
    const total = sumInLb([
      { weight: 400, unit: "lb" }, // squat
      { weight: 300, unit: "lb" }, // bench
      { weight: 200, unit: "kg" }, // deadlift, logged in kg (~440 lb)
    ]);
    expect(total).toBeCloseTo(1140.92, 1);
  });
});

describe("roundToIncrement / convertForDisplay", () => {
  it("rounds to the nearest increment", () => {
    expect(roundToIncrement(262, 5)).toBe(260);
    expect(roundToIncrement(126, 2.5)).toBe(125);
  });

  it("converts and rounds for chart/display purposes", () => {
    expect(convertForDisplay(100, "kg", "lb")).toBeCloseTo(220.5, 0);
    expect(convertForDisplay(225, "lb", "lb")).toBe(225);
  });
});
