import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_TAXONOMY,
  LAUNCH_LINKS,
  OCTOBER_BASELINE_TARGETS,
  addDays,
  mondayOfWeek,
  newYorkDate,
  newYorkMidnightUtc,
  progress,
} from "./launchOps";

describe("launch operations", () => {
  it("uses the correct Monday cohort week", () => {
    expect(mondayOfWeek("2026-09-30")).toBe("2026-09-28");
    expect(mondayOfWeek("2026-10-04")).toBe("2026-09-28");
    expect(mondayOfWeek("2026-10-05")).toBe("2026-10-05");
  });

  it("resolves New York local dates", () => {
    expect(newYorkDate(new Date("2026-10-01T02:00:00Z"))).toBe("2026-09-30");
  });

  it("creates Eastern local-midnight UTC boundaries", () => {
    expect(newYorkMidnightUtc("2026-09-30")).toBe("2026-09-30T04:00:00.000Z");
    expect(newYorkMidnightUtc("2026-11-10")).toBe("2026-11-10T05:00:00.000Z");
    expect(addDays("2026-09-28", 7)).toBe("2026-10-05");
  });

  it("caps progress at 100 percent", () => {
    expect(progress(5, 10)).toBe(50);
    expect(progress(12, 10)).toBe(100);
  });

  it("defines an October sales baseline", () => {
    expect(OCTOBER_BASELINE_TARGETS.newLeads).toBe(10);
    expect(OCTOBER_BASELINE_TARGETS.won).toBe(1);
    expect(OCTOBER_BASELINE_TARGETS.contractedCents).toBe(39900);
  });

  it("ships tagged core and Shift Reset links", () => {
    const core = LAUNCH_LINKS.find((link) => link.key === "bio_main");
    const reset = LAUNCH_LINKS.find((link) => link.key === "reset_enroll");
    expect(core?.path).toContain("utm_campaign=2026_10_core");
    expect(reset?.path).toContain("utm_campaign=2026_10_shift_reset");
    expect(CAMPAIGN_TAXONOMY.contentPattern).toContain("YYYYMMDD");
  });
});
