import { describe, it, expect } from "vitest";
import {
  currentCheckinDate,
  nextCheckinDate,
  checkinStatus,
  checkinState,
  compareCheckins,
  RESPONSE_SLA_HOURS,
  type Checkin,
} from "./checkin";
import type { Engagement } from "@/domain/engagement";

// 2026-08-02 is a Sunday; checkin_weekday 0 = Sunday.
function engagement(over: Partial<Engagement> = {}): Engagement {
  return {
    id: "e1", profile_id: "c1", offer_code: "X", agreed_amount_cents: 0, currency: "USD",
    starts_on: "2026-08-02", ends_on: null, engagement_weeks: null,
    checkin_weekday: 0, day_boundary_hour: 4, billing_kind: "manual_invoice",
    rate_kind: "standard", status: "active", mode: "general", ...over,
  };
}

function checkin(over: Partial<Checkin> = {}): Checkin {
  return {
    id: "k1", profile_id: "c1", due_local_date: "2026-08-30",
    submitted_at: null, reviewed_at: null, coach_responded_at: null,
    weight: null, waist: null, sleep_avg: null, night_shifts: null, steps_avg: null,
    nutrition_adherence: null, protein_days: null, alcohol_drinks: null,
    energy: null, stress: null, win: null, struggle: null, ask: null,
    coach_response: null, ...over,
  };
}

describe("check-in dates", () => {
  it("lands on the client's chosen weekday", () => {
    // Engagement starts Sunday, check-in day is Sunday.
    expect(currentCheckinDate(engagement(), "2026-08-30")).toBe("2026-08-30");
  });

  it("walks forward from the start when the weekday differs", () => {
    // Starts Sunday 2 Aug, check-ins on Wednesday -> first is 5 Aug.
    expect(currentCheckinDate(engagement({ checkin_weekday: 3 }), "2026-08-06")).toBe("2026-08-05");
  });

  it("returns the most recent one that has come due, not a future one", () => {
    expect(currentCheckinDate(engagement(), "2026-09-02")).toBe("2026-08-30");
  });

  it("returns the first upcoming date before any has fallen due", () => {
    expect(currentCheckinDate(engagement({ checkin_weekday: 3 }), "2026-08-03")).toBe("2026-08-05");
  });

  it("finds the next one on or after today", () => {
    expect(nextCheckinDate(engagement(), "2026-09-02")).toBe("2026-09-06");
    expect(nextCheckinDate(engagement(), "2026-08-30")).toBe("2026-08-30");
  });

  it("has no dates without an engagement", () => {
    expect(currentCheckinDate(null, "2026-08-30")).toBeNull();
    expect(nextCheckinDate(null, "2026-08-30")).toBeNull();
  });
});

describe("checkinStatus", () => {
  it("is upcoming before the due date", () => {
    expect(checkinStatus(null, "2026-09-06", "2026-08-30")).toBe("upcoming");
  });

  it("is due on the day, with a day of grace", () => {
    expect(checkinStatus(null, "2026-08-30", "2026-08-30")).toBe("due");
    expect(checkinStatus(null, "2026-08-30", "2026-08-31")).toBe("due");
  });

  it("goes overdue after the grace day", () => {
    expect(checkinStatus(null, "2026-08-30", "2026-09-01")).toBe("overdue");
  });

  it("tracks the coach's half of the exchange, not just the client's", () => {
    // Submitting is not the end of the loop. The coach responding is.
    expect(checkinStatus(checkin({ submitted_at: "2026-08-30T10:00:00Z" }), "2026-08-30", "2026-09-05"))
      .toBe("submitted");
    expect(
      checkinStatus(
        checkin({ submitted_at: "2026-08-30T10:00:00Z", reviewed_at: "2026-08-31T10:00:00Z" }),
        "2026-08-30",
        "2026-09-05",
      ),
    ).toBe("reviewed");
    expect(
      checkinStatus(
        checkin({
          submitted_at: "2026-08-30T10:00:00Z",
          reviewed_at: "2026-08-31T10:00:00Z",
          coach_responded_at: "2026-08-31T11:00:00Z",
        }),
        "2026-08-30",
        "2026-09-05",
      ),
    ).toBe("responded");
  });

  it("a submitted check-in never reads as overdue, however long ago it was due", () => {
    expect(checkinStatus(checkin({ submitted_at: "2026-08-30T10:00:00Z" }), "2026-07-01", "2026-09-30"))
      .toBe("submitted");
  });
});

describe("checkinState", () => {
  const NOW = "2026-09-05T12:00:00.000Z";

  it("counts how overdue an unsubmitted check-in is", () => {
    const s = checkinState(engagement(), null, "2026-09-05", NOW);
    expect(s.status).toBe("overdue");
    expect(s.dueOn).toBe("2026-08-30");
    expect(s.daysOverdue).toBe(6);
  });

  it("measures how long the coach has left one sitting", () => {
    const s = checkinState(
      engagement(),
      checkin({ submitted_at: "2026-09-03T12:00:00.000Z" }),
      "2026-09-05",
      NOW,
    );
    expect(s.hoursAwaitingResponse).toBe(48);
    expect(s.responseOverdue).toBe(true);
  });

  it("stays inside the SLA when the coach is prompt", () => {
    const s = checkinState(
      engagement(),
      checkin({ submitted_at: "2026-09-05T06:00:00.000Z" }),
      "2026-09-05",
      NOW,
    );
    expect(s.hoursAwaitingResponse).toBeLessThan(RESPONSE_SLA_HOURS);
    expect(s.responseOverdue).toBe(false);
  });

  it("stops the clock once the coach has replied", () => {
    const s = checkinState(
      engagement(),
      checkin({
        submitted_at: "2026-08-30T10:00:00.000Z",
        coach_responded_at: "2026-08-30T18:00:00.000Z",
      }),
      "2026-09-05",
      NOW,
    );
    expect(s.hoursAwaitingResponse).toBeNull();
    expect(s.responseOverdue).toBe(false);
  });

  it("says nothing for a client with no engagement", () => {
    const s = checkinState(null, null, "2026-09-05", NOW);
    expect(s.dueOn).toBeNull();
    expect(s.status).toBe("upcoming");
  });
});

describe("compareCheckins", () => {
  const current = checkin({ weight: 205, waist: 36, energy: 4, stress: 8, sleep_avg: 5 });
  const previous = checkin({ id: "k0", weight: 208, waist: 36.2, energy: 7, stress: 4, sleep_avg: 7 });

  it("puts this week beside last week", () => {
    const weight = compareCheckins(current, previous).find((f) => f.key === "weight")!;
    expect(weight).toMatchObject({ current: 205, previous: 208, delta: -3 });
  });

  it("marks the changes worth eight minutes of attention", () => {
    const fields = compareCheckins(current, previous);
    const notable = fields.filter((f) => f.notable).map((f) => f.key);
    expect(notable).toContain("weight");
    expect(notable).toContain("energy");
    expect(notable).toContain("stress");
    // Waist moved 0.2 — real, but not what the coach should be looking at first.
    expect(notable).not.toContain("waist");
  });

  it("copes with a client's very first check-in", () => {
    const fields = compareCheckins(current, null);
    expect(fields.every((f) => f.previous === null && f.delta === null)).toBe(true);
    expect(fields.some((f) => f.notable)).toBe(false);
  });

  it("does not invent a delta from a missing answer", () => {
    const partial = checkin({ weight: 205 });
    const field = compareCheckins(partial, previous).find((f) => f.key === "energy")!;
    expect(field.delta).toBeNull();
    expect(field.notable).toBe(false);
  });
});
