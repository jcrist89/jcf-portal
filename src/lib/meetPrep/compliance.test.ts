import { describe, it, expect } from "vitest";
import { computeWeeklyCompliance } from "./compliance";
import type { Program, WorkoutLog, DeviationReport, ReadinessCheckin } from "../types";

const program: Program = {
  id: "prog-1",
  goal: "powerlifting",
  name: "Meet Prep",
  description: null,
  structure: {
    weeks: [
      {
        week: 1,
        days: [
          { day: 1, label: "Week 1 — Squat", exercises: [] },
          { day: 2, label: "Week 1 — Bench", exercises: [] },
          { day: 3, label: "Rest", exercises: [] },
        ],
      },
    ],
  },
  is_template: false,
  is_default_template: false,
  client_id: "client-1",
  meet_date: null,
  attempt_plan: null,
  weaknesses: null,
  created_at: "",
  updated_at: "",
};

function log(overrides: Partial<WorkoutLog>): WorkoutLog {
  return {
    id: "log-1",
    profile_id: "client-1",
    program_id: "prog-1",
    date: "2026-01-01",
    day_label: "Week 1 — Squat",
    exercises_completed: [],
    completed: true,
    created_at: "",
    ...overrides,
  };
}

describe("computeWeeklyCompliance", () => {
  it("scores 100/Excellent for a fully completed, deviation-free, readiness-logged week", () => {
    const logs = [
      log({ id: "l1", day_label: "Week 1 — Squat", date: "2026-01-01" }),
      log({ id: "l2", day_label: "Week 1 — Bench", date: "2026-01-02" }),
    ];
    const readiness: ReadinessCheckin[] = [
      { id: "r1", profile_id: "client-1", date: "2026-01-01", sleep: 3, fatigue: 3, soreness: 3, joint_pain: 3, stress: 3, motivation: 3, nutrition: 3, confidence: 3, score: 60, tier: "moderate", created_at: "" },
      { id: "r2", profile_id: "client-1", date: "2026-01-02", sleep: 3, fatigue: 3, soreness: 3, joint_pain: 3, stress: 3, motivation: 3, nutrition: 3, confidence: 3, score: 60, tier: "moderate", created_at: "" },
    ];
    const result = computeWeeklyCompliance({ program, logs, deviations: [], readiness, week: 1 });
    expect(result).toEqual({ week: 1, score: 100, category: "Excellent" });
  });

  it("deducts 10 per missed planned day (rest days excluded)", () => {
    const logs = [log({ id: "l1", day_label: "Week 1 — Squat", date: "2026-01-01" })];
    const result = computeWeeklyCompliance({ program, logs, deviations: [], readiness: [], week: 1 });
    // 1 of 2 planned days missed (-10), plus missing readiness on the one logged day (-5)
    expect(result.score).toBe(85);
    expect(result.category).toBe("Acceptable");
  });

  it("scores 0 when nothing was logged for the week", () => {
    const result = computeWeeklyCompliance({ program, logs: [], deviations: [], readiness: [], week: 1 });
    expect(result.score).toBe(0);
    expect(result.category).toBe("Coach Review Required");
  });

  it("deducts 15 per unresolved deviation this week", () => {
    const logs = [
      log({ id: "l1", day_label: "Week 1 — Squat", date: "2026-01-01" }),
      log({ id: "l2", day_label: "Week 1 — Bench", date: "2026-01-02" }),
    ];
    const readiness: ReadinessCheckin[] = [
      { id: "r1", profile_id: "client-1", date: "2026-01-01", sleep: 3, fatigue: 3, soreness: 3, joint_pain: 3, stress: 3, motivation: 3, nutrition: 3, confidence: 3, score: 60, tier: "moderate", created_at: "" },
      { id: "r2", profile_id: "client-1", date: "2026-01-02", sleep: 3, fatigue: 3, soreness: 3, joint_pain: 3, stress: 3, motivation: 3, nutrition: 3, confidence: 3, score: 60, tier: "moderate", created_at: "" },
    ];
    const deviations: DeviationReport[] = [
      { id: "d1", profile_id: "client-1", workout_log_id: "l1", exercise_name: "Squat", lift_key: null, week_number: 1, prescribed_weight: null, actual_weight: 100, reason: null, actual_rpe: null, pain_score: null, technical_rating: null, reviewed: false, created_at: "" },
    ];
    const result = computeWeeklyCompliance({ program, logs, deviations, readiness, week: 1 });
    expect(result.score).toBe(85);
  });

  it("ignores logs from a different program even with a matching day label", () => {
    const logs = [
      log({ id: "l1", day_label: "Week 1 — Squat", date: "2026-01-01", program_id: "other-prog" }),
    ];
    const result = computeWeeklyCompliance({ program, logs, deviations: [], readiness: [], week: 1 });
    expect(result.score).toBe(0); // neither planned day counted as logged
  });

  it("returns a perfect score when the week has no planned days (e.g. a full rest week)", () => {
    const restProgram: Program = {
      ...program,
      structure: { weeks: [{ week: 2, days: [{ day: 1, label: "Rest", exercises: [] }] }] },
    };
    const result = computeWeeklyCompliance({ program: restProgram, logs: [], deviations: [], readiness: [], week: 2 });
    expect(result).toEqual({ week: 2, score: 100, category: "Excellent" });
  });
});
