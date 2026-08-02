import { describe, it, expect } from "vitest";
import { computeStreak, buildNudge } from "./dashboardStats";

describe("computeStreak", () => {
  it("returns 0 for no dates", () => {
    expect(computeStreak([])).toBe(0);
  });
  it("finds the longest consecutive-week run", () => {
    expect(computeStreak(["2026-01-05", "2026-01-12", "2026-01-19"])).toBe(3);
  });
});

describe("buildNudge", () => {
  it("nudges a new account with no logs after 2+ days", () => {
    expect(buildNudge(null, 3, 0)?.level).toBe("warning");
  });
  it("does not nudge a brand-new account (< 2 days) with no logs", () => {
    expect(buildNudge(null, 0, 0)).toBeNull();
  });
  it("escalates to danger at 14+ days quiet", () => {
    expect(buildNudge(14, 30, 3)?.level).toBe("danger");
  });
  it("escalates to danger at 7+ days quiet", () => {
    expect(buildNudge(7, 30, 3)?.level).toBe("danger");
  });
  it("gives a soft warning at 3+ days with an active streak", () => {
    expect(buildNudge(3, 30, 2)?.level).toBe("warning");
  });
  it("says nothing for a recently-active client", () => {
    expect(buildNudge(1, 30, 3)).toBeNull();
  });
});
