import { describe, it, expect } from "vitest";
import { flattenProgram, programPosition } from "./program";
import type { Program, ScheduleMode } from "@/lib/types";

function build(
  weeks: number,
  daysPerWeek: number,
  opts: { startsOn?: string | null; mode?: ScheduleMode; meetDate?: string | null } = {},
): Program {
  return {
    id: "p1",
    goal: "powerlifting",
    name: "Block",
    description: null,
    structure: {
      weeks: Array.from({ length: weeks }, (_, w) => ({
        week: w + 1,
        days: Array.from({ length: daysPerWeek }, (_, d) => ({
          day: d + 1,
          label: `Day ${d + 1}`,
          exercises: [],
        })),
      })),
    },
    is_template: false,
    is_default_template: false,
    client_id: "c1",
    starts_on: opts.startsOn ?? null,
    schedule_mode: opts.mode ?? "sequential",
    meet_date: opts.meetDate ?? null,
    attempt_plan: null,
    weaknesses: null,
    created_at: "",
    updated_at: "",
  };
}

/** n completed sessions on consecutive days, logged against program `p1` by default. */
const logs = (n: number, from = "2026-08-03", programId: string | null = "p1") =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${from}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), completed: true, program_id: programId };
  });

describe("flattenProgram", () => {
  it("returns an empty list for no program", () => {
    expect(flattenProgram(null)).toEqual([]);
  });
  it("indexes days sequentially across weeks", () => {
    const flat = flattenProgram(build(3, 4));
    expect(flat).toHaveLength(12);
    expect(flat[4]).toMatchObject({ week: 2, day: 1, index: 4 });
  });
});

describe("programPosition — sequential", () => {
  it("serves the next undone session", () => {
    const pos = programPosition(build(4, 3), logs(5), new Date("2026-08-20T12:00:00Z"));
    expect(pos.index).toBe(5);
    expect(pos.day?.week).toBe(2);
  });

  it("does NOT wrap around once the block is finished", () => {
    // The old `completedCount % flat.length` silently restarted at week 1 here.
    const program = build(2, 3); // 6 sessions
    const pos = programPosition(program, logs(6), new Date("2026-08-20T12:00:00Z"));
    expect(pos.complete).toBe(true);
    expect(pos.day).toBeNull();
    expect(pos.index).toBe(-1);
  });

  it("reports the calendar week from starts_on, independent of workouts done", () => {
    const program = build(12, 4, { startsOn: "2026-08-02" });
    const pos = programPosition(program, logs(4), new Date("2026-08-30T12:00:00Z"));
    expect(pos.calendarWeek).toBe(5);
    expect(pos.totalWeeks).toBe(12);
  });

  it("counts how many sessions the calendar expected but never happened", () => {
    // 4 weeks in at 4 sessions/week = 20 expected; 4 done.
    const program = build(13, 4, { startsOn: "2026-08-02" });
    const pos = programPosition(program, logs(4), new Date("2026-08-30T12:00:00Z"));
    expect(pos.sessionsBehind).toBe(16);
  });

  it("is never behind when the client is on pace", () => {
    const program = build(4, 3, { startsOn: "2026-08-24" });
    const pos = programPosition(program, logs(3, "2026-08-24"), new Date("2026-08-26T12:00:00Z"));
    expect(pos.sessionsBehind).toBe(0);
  });

  it("has no calendar week when the program was never anchored", () => {
    const pos = programPosition(build(4, 3), logs(2), new Date("2026-08-30T12:00:00Z"));
    expect(pos.calendarWeek).toBeNull();
    expect(pos.sessionsBehind).toBe(0);
  });
});

describe("programPosition — date_anchored", () => {
  const meetBlock = () =>
    build(13, 4, { startsOn: "2026-08-02", mode: "date_anchored", meetDate: "2026-10-31" });

  it("follows the calendar rather than the workout count", () => {
    // The live failure this replaces: 4 completed sessions in a 13-week block that
    // started 2 Aug served week 2 day 1 on 30 Aug, when the client was in week 5.
    const pos = programPosition(meetBlock(), logs(4), new Date("2026-08-30T12:00:00Z"));
    expect(pos.calendarWeek).toBe(5);
    expect(pos.day?.week).toBe(5);
  });

  it("does not pull work forward once the week's sessions are done", () => {
    const done = logs(4, "2026-08-30"); // all 4 sessions inside week 5's window
    const pos = programPosition(meetBlock(), done, new Date("2026-09-02T12:00:00Z"));
    expect(pos.day).toBeNull();
    expect(pos.calendarWeek).toBe(5);
  });

  it("advances with the calendar even when nothing was completed", () => {
    const pos = programPosition(meetBlock(), [], new Date("2026-09-13T12:00:00Z"));
    expect(pos.calendarWeek).toBe(7);
    expect(pos.day?.week).toBe(7);
  });

  it("is complete once the calendar runs past the block", () => {
    const pos = programPosition(meetBlock(), logs(4), new Date("2026-11-15T12:00:00Z"));
    expect(pos.complete).toBe(true);
    expect(pos.day).toBeNull();
  });
});

describe("programPosition — no program", () => {
  it("returns an empty position", () => {
    const pos = programPosition(null, []);
    expect(pos).toMatchObject({ day: null, index: -1, complete: false, totalWeeks: 0 });
  });
});

// Regression: position used to be derived from every completed log the client had
// ever written, regardless of which program it belonged to. Assigning a lapsed client
// a fresh block would then open them on session four instead of session one.
describe("programPosition — scoping to the current program", () => {
  it("ignores sessions completed against a previous block", () => {
    const fresh = build(4, 4, { startsOn: "2026-08-30" });
    const history = [
      ...logs(3, "2026-07-27", "old-block"), // an earlier, abandoned program
      ...logs(0),
    ];
    const pos = programPosition(fresh, history, new Date("2026-08-30T12:00:00Z"));
    expect(pos.index).toBe(0);
    expect(pos.day?.week).toBe(1);
    expect(pos.day?.day).toBe(1);
  });

  it("ignores incomplete sessions on the current block", () => {
    const program = build(4, 4, { startsOn: "2026-08-24" });
    const history = [
      ...logs(2, "2026-08-24"),
      { date: "2026-08-26", completed: false, program_id: "p1" },
    ];
    expect(programPosition(program, history, new Date("2026-08-26T12:00:00Z")).index).toBe(2);
  });

  it("counts only this block when the client has run several", () => {
    const program = build(4, 4, { startsOn: "2026-08-24" });
    const history = [
      ...logs(5, "2026-06-01", "block-a"),
      ...logs(2, "2026-08-24", "p1"),
      ...logs(4, "2026-07-01", "block-b"),
    ];
    expect(programPosition(program, history, new Date("2026-08-26T12:00:00Z")).index).toBe(2);
  });
});
