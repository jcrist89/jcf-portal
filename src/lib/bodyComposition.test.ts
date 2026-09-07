import { describe, expect, it } from "vitest";
import { estimateBodyComposition } from "./bodyComposition";

describe("estimateBodyComposition", () => {
  it("uses the male circumference equation", () => {
    expect(estimateBodyComposition({ sex: "male", heightIn: 70, weightLb: 190, waistIn: 34, neckIn: 15.5, hipsIn: null }))
      .toEqual({ bodyFatPercent: 16.5, leanMassLb: 158.7 });
  });

  it("uses the female circumference equation", () => {
    expect(estimateBodyComposition({ sex: "female", heightIn: 65, weightLb: 140, waistIn: 28, neckIn: 12.5, hipsIn: 38 }))
      .toEqual({ bodyFatPercent: 26.6, leanMassLb: 102.8 });
  });

  it("requires the sex-specific measurements", () => {
    expect(estimateBodyComposition({ sex: "female", heightIn: 65, weightLb: 140, waistIn: 28, neckIn: 12.5, hipsIn: null })).toBeNull();
    expect(estimateBodyComposition({ sex: null, heightIn: 70, weightLb: 190, waistIn: 34, neckIn: 15.5, hipsIn: null })).toBeNull();
  });
});
