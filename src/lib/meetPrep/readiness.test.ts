import { describe, it, expect } from "vitest";
import { scoreReadiness } from "./readiness";

const base = { sleep: 3, fatigue: 3, soreness: 3, jointPain: 3, stress: 3, motivation: 3, nutrition: 3, confidence: 3 };

describe("scoreReadiness", () => {
  it("scores a perfect check-in as high", () => {
    const { score, tier } = scoreReadiness({
      ...base,
      sleep: 5,
      fatigue: 1,
      soreness: 1,
      jointPain: 1,
      stress: 1,
      motivation: 5,
      nutrition: 5,
      confidence: 5,
    });
    expect(score).toBe(100);
    expect(tier).toBe("high");
  });

  it("scores a terrible check-in as very_low", () => {
    const { score, tier } = scoreReadiness({
      ...base,
      sleep: 1,
      fatigue: 5,
      soreness: 5,
      jointPain: 5,
      stress: 5,
      motivation: 1,
      nutrition: 1,
      confidence: 1,
    });
    expect(score).toBe(20);
    expect(tier).toBe("very_low");
  });

  it("mid-range values land in moderate", () => {
    const { tier } = scoreReadiness(base);
    expect(tier).toBe("moderate");
  });

  it("forces very_low on meaningful joint pain even with an otherwise good score", () => {
    const { score, tier } = scoreReadiness({
      ...base,
      sleep: 5,
      fatigue: 1,
      soreness: 1,
      jointPain: 4, // meaningful pain
      stress: 1,
      motivation: 5,
      nutrition: 5,
      confidence: 5,
    });
    expect(score).toBeGreaterThanOrEqual(80); // score alone would be "high"
    expect(tier).toBe("very_low"); // but pain overrides it
  });

  it("blocks a top single at very_low readiness (the eligibility gate downstream depends on this)", () => {
    const { tier } = scoreReadiness({
      ...base,
      sleep: 1,
      fatigue: 5,
      soreness: 5,
      jointPain: 1,
      stress: 5,
      motivation: 1,
      nutrition: 1,
      confidence: 1,
    });
    expect(tier).toBe("very_low");
  });
});
