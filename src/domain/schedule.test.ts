import { describe, it, expect } from "vitest";
import { schedulePosition, type ScheduledSession, type ScheduleAssignment } from "./schedule";
import type { ScheduleMode, SessionStatus } from "@/lib/types";

function assignment(mode: ScheduleMode, startsOn = "2026-08-02"): ScheduleAssignment {
  return { id: "a1", starts_on: startsOn, schedule_mode: mode, timezone: "America/Toronto" };
}

/** A block of `weeks` x `perWeek` sessions, one per consecutive day within each week. */
function block(weeks: number, perWeek: number, startsOn = "2026-08-02"): ScheduledSession[] {
  const out: ScheduledSession[] = [];
  let seq = 1;
  for (let w = 1; w <= weeks; w++) {
    for (let d = 1; d <= perWeek; d++) {
      const offset = (w - 1) * 7 + (d - 1);
      const date = new Date(`${startsOn}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + offset);
      out.push({
        id: `s${seq}`,
        week_number: w,
        day_number: d,
        sequence: seq,
        scheduled_local_date: date.toISOString().slice(0, 10),
        label: `W${w} D${d}`,
        status: "prescribed",
      });
      seq += 1;
    }
  }
  return out;
}

const setStatus = (s: ScheduledSession[], ids: number[], status: SessionStatus) =>
  s.map((x) => (ids.includes(x.sequence) ? { ...x, status } : x));

describe("schedulePosition — sequential", () => {
  it("serves the next undone session regardless of its date", () => {
    const sessions = setStatus(block(4, 4), [1, 2, 3], "completed");
    const pos = schedulePosition(assignment("sequential"), sessions, "2026-08-30");
    expect(pos.session?.label).toBe("W1 D4");
    expect(pos.dueToday).toBe(true);
  });

  it("lets a missed session wait rather than dropping it", () => {
    // Four weeks in, only one session done — the rest are still owed, not gone.
    const sessions = setStatus(block(4, 4), [1], "completed");
    const pos = schedulePosition(assignment("sequential"), sessions, "2026-08-30");
    expect(pos.session?.label).toBe("W1 D2");
    expect(pos.adherence.missed).toBe(0);
  });

  it("counts how far behind the calendar the client has fallen", () => {
    const sessions = setStatus(block(4, 4), [1], "completed");
    const pos = schedulePosition(assignment("sequential"), sessions, "2026-08-30");
    // 15 outstanding sessions were scheduled on or before 30 Aug.
    expect(pos.sessionsBehind).toBe(15);
  });

  it("is not behind when the client is on pace", () => {
    const sessions = setStatus(block(4, 4), [1, 2, 3, 4], "completed");
    const pos = schedulePosition(assignment("sequential"), sessions, "2026-08-05");
    expect(pos.sessionsBehind).toBe(0);
  });

  it("reports complete when every session is done", () => {
    const sessions = block(2, 2).map((s) => ({ ...s, status: "completed" as const }));
    const pos = schedulePosition(assignment("sequential"), sessions, "2026-08-30");
    expect(pos.complete).toBe(true);
    expect(pos.session).toBeNull();
  });
});

describe("schedulePosition — date_anchored", () => {
  const a = assignment("date_anchored");

  it("serves the session scheduled for today", () => {
    // Week 5 day 1 falls on 30 Aug for a block starting 2 Aug.
    const pos = schedulePosition(a, block(13, 4), "2026-08-30");
    expect(pos.session?.label).toBe("W5 D1");
    expect(pos.dueToday).toBe(true);
  });

  it("shows a rest day rather than pulling work forward", () => {
    // 3 Sep is week 5 day 5 — the block only has 4 days a week, so nothing is due.
    const pos = schedulePosition(a, block(13, 4), "2026-09-03");
    expect(pos.dueToday).toBe(false);
    expect(pos.session?.label).toBe("W6 D1");
  });

  it("treats a passed session as missed even before the nightly sweep marks it", () => {
    // Every week-1..4 session is still 'prescribed' — the cron has not run.
    const pos = schedulePosition(a, block(13, 4), "2026-08-30");
    expect(pos.adherence.missed).toBe(16);
    expect(pos.session?.label).toBe("W5 D1"); // never last week's work
  });

  it("agrees with the swept state, so a late cron degrades reporting not behaviour", () => {
    const swept = setStatus(block(13, 4), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], "skipped");
    const derived = schedulePosition(a, block(13, 4), "2026-08-30");
    const persisted = schedulePosition(a, swept, "2026-08-30");
    expect(persisted.adherence).toEqual(derived.adherence);
    expect(persisted.session?.label).toBe(derived.session?.label);
  });
});

describe("schedulePosition — adherence", () => {
  it("counts a scaled session as adherent", () => {
    let sessions = setStatus(block(2, 4), [1, 2], "completed");
    sessions = setStatus(sessions, [3], "scaled");
    sessions = setStatus(sessions, [4], "skipped");
    const pos = schedulePosition(assignment("sequential"), sessions, "2026-08-30");
    expect(pos.adherence).toMatchObject({ completed: 2, scaled: 1, missed: 1, accountedFor: 4, pct: 75 });
  });

  it("is null before anything has come due, rather than 0%", () => {
    const pos = schedulePosition(assignment("sequential"), block(4, 4), "2026-08-02");
    expect(pos.adherence.pct).toBeNull();
  });

  it("reproduces the live meet-prep figure", () => {
    // Stuart: 3 of 16 scheduled sessions through week four.
    let sessions = block(13, 4);
    sessions = setStatus(sessions, [2, 3, 4], "completed");
    sessions = setStatus(sessions, [1, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], "skipped");
    const pos = schedulePosition(assignment("date_anchored"), sessions, "2026-08-30");
    expect(pos.adherence.pct).toBe(19);
    expect(pos.session?.label).toBe("W5 D1");
  });
});

describe("schedulePosition — nothing to schedule", () => {
  it("is empty without an assignment", () => {
    expect(schedulePosition(null, block(1, 1), "2026-08-30").session).toBeNull();
  });
  it("is empty without sessions", () => {
    expect(schedulePosition(assignment("sequential"), [], "2026-08-30").session).toBeNull();
  });
});
