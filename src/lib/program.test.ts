import { describe, it, expect } from "vitest";
import { flattenProgram } from "./program";
import type { Program } from "@/lib/types";

function build(weeks: number, daysPerWeek: number): Program {
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
    starts_on: "2026-08-02",
    schedule_mode: "sequential",
    meet_date: null,
    attempt_plan: null,
    weaknesses: null,
    created_at: "",
    updated_at: "",
  };
}

// flattenProgram survives the move to materialized sessions: it still supplies the
// prescription for whichever session the schedule selects. Scheduling itself is now
// tested against real session rows in domain/schedule.test.ts.
describe("flattenProgram", () => {
  it("returns an empty list for no program", () => {
    expect(flattenProgram(null)).toEqual([]);
  });

  it("indexes days sequentially across weeks", () => {
    const flat = flattenProgram(build(3, 4));
    expect(flat).toHaveLength(12);
    expect(flat[4]).toMatchObject({ week: 2, day: 1, index: 4 });
  });

  it("lets a session be located by week and day, which is how the schedule addresses it", () => {
    const flat = flattenProgram(build(13, 4));
    const found = flat.find((d) => d.week === 5 && d.day === 1);
    expect(found?.index).toBe(16);
  });

  it("tolerates a program with no weeks", () => {
    const empty = { ...build(0, 0), structure: { weeks: [] } };
    expect(flattenProgram(empty)).toEqual([]);
  });
});
