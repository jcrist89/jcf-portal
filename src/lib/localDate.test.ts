import { describe, it, expect } from "vitest";
import { localDateIn, trainingDateIn, resolveLocalDate } from "./localDate";

const TO = "America/Toronto";

describe("localDateIn", () => {
  it("resolves the local calendar date, not the UTC one", () => {
    // 01:30 Tuesday in Toronto is 05:30 Wednesday UTC.
    expect(localDateIn(TO, new Date("2026-08-26T05:30:00Z"))).toBe("2026-08-26");
    expect(localDateIn("UTC", new Date("2026-08-26T05:30:00Z"))).toBe("2026-08-26");
    expect(localDateIn(TO, new Date("2026-08-26T03:30:00Z"))).toBe("2026-08-25");
  });

  it("falls back to a sane zone rather than throwing on a bad one", () => {
    expect(() => localDateIn("Not/AZone", new Date("2026-08-26T12:00:00Z"))).not.toThrow();
  });

  it("handles a DST boundary", () => {
    // Eastern DST ends 2026-11-01 at 02:00 local.
    expect(localDateIn(TO, new Date("2026-11-01T04:30:00Z"))).toBe("2026-11-01");
    expect(localDateIn(TO, new Date("2026-11-01T03:30:00Z"))).toBe("2026-10-31");
  });
});

describe("trainingDateIn", () => {
  it("files a post-midnight session under the day the client trained", () => {
    // 01:30 local on the 26th — the night shift that started on the 25th.
    expect(trainingDateIn(TO, new Date("2026-08-26T05:30:00Z"))).toBe("2026-08-25");
  });

  it("uses the local date once past the boundary hour", () => {
    // 08:00 local on the 26th.
    expect(trainingDateIn(TO, new Date("2026-08-26T12:00:00Z"))).toBe("2026-08-26");
  });

  it("respects a custom boundary", () => {
    // 01:30 local, boundary at midnight — no shift.
    expect(trainingDateIn(TO, new Date("2026-08-26T05:30:00Z"), 0)).toBe("2026-08-26");
  });
});

describe("resolveLocalDate", () => {
  const at = new Date("2026-08-26T12:00:00Z"); // 08:00 in Toronto

  it("accepts a client-supplied date for the same day", () => {
    expect(resolveLocalDate("2026-08-26", TO, at)).toBe("2026-08-26");
  });

  it("accepts a write that was queued offline overnight", () => {
    expect(resolveLocalDate("2026-08-25", TO, at)).toBe("2026-08-25");
  });

  it("rejects an arbitrary date and falls back to the server's answer", () => {
    expect(resolveLocalDate("2020-01-01", TO, at)).toBe("2026-08-26");
    expect(resolveLocalDate("2027-12-25", TO, at)).toBe("2026-08-26");
  });

  it("ignores malformed input", () => {
    expect(resolveLocalDate("yesterday", TO, at)).toBe("2026-08-26");
    expect(resolveLocalDate(undefined, TO, at)).toBe("2026-08-26");
    expect(resolveLocalDate(1756209600, TO, at)).toBe("2026-08-26");
  });
});
