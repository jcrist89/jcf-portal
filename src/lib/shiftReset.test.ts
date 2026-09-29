import { describe, expect, it } from "vitest";
import {
  SHIFT_RESET_CAP,
  dateInNewYork,
  shiftResetEnrollmentOpen,
} from "./shiftReset";

describe("Shift Reset enrollment gate", () => {
  it("is closed before October 26", () => {
    expect(shiftResetEnrollmentOpen(0, new Date("2026-10-25T18:00:00Z"))).toBe(false);
  });

  it("opens on October 26 in New York", () => {
    expect(dateInNewYork(new Date("2026-10-26T12:00:00Z"))).toBe("2026-10-26");
    expect(shiftResetEnrollmentOpen(0, new Date("2026-10-26T12:00:00Z"))).toBe(true);
  });

  it("closes when the cap is reached", () => {
    expect(shiftResetEnrollmentOpen(SHIFT_RESET_CAP, new Date("2026-10-30T12:00:00Z"))).toBe(false);
  });

  it("closes before the cohort begins November 9", () => {
    expect(shiftResetEnrollmentOpen(9, new Date("2026-11-09T12:00:00Z"))).toBe(false);
  });
});
