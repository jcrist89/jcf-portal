import { describe, it, expect } from "vitest";
import { bestWeightForExercise, detectNewPRs, sameExercise, lastPerformanceFor } from "./workoutHistory";
import type { WorkoutLog, ExerciseLog } from "@/lib/types";

function log(date: string, exercises: ExerciseLog[]): WorkoutLog {
  return { id: `log-${date}`, profile_id: "p1", program_id: null, date, day_label: null, exercises_completed: exercises, completed: true, created_at: "" };
}

describe("bestWeightForExercise — mixed-unit history", () => {
  it("correctly identifies a kg entry as the best even though its raw number is smaller than a later lb entry", () => {
    const logs = [
      log("2026-01-01", [{ name: "Meet Bench", sets: [{ weight: 100, reps: 1, rpe: 8 }], unit: "kg" }]), // ~220 lb
      log("2026-01-08", [{ name: "Meet Bench", sets: [{ weight: 200, reps: 1, rpe: 8 }], unit: "lb" }]), // 200 lb — lighter!
    ];
    const best = bestWeightForExercise(logs, { name: "Meet Bench" });
    expect(best?.weight).toBe(100);
    expect(best?.unit).toBe("kg");
    expect(best?.date).toBe("2026-01-01");
  });

  it("compares raw numbers correctly when everything is the same unit", () => {
    const logs = [
      log("2026-01-01", [{ name: "Squat", sets: [{ weight: 300, reps: 5, rpe: 8 }], unit: "lb" }]),
      log("2026-01-08", [{ name: "Squat", sets: [{ weight: 315, reps: 3, rpe: 8 }], unit: "lb" }]),
    ];
    const best = bestWeightForExercise(logs, { name: "Squat" });
    expect(best?.weight).toBe(315);
  });
});

describe("detectNewPRs — mixed-unit history", () => {
  it("does not flag a lb entry as a new PR when a heavier kg entry already exists", () => {
    const priorLogs = [log("2026-01-01", [{ name: "Meet Bench", sets: [{ weight: 100, reps: 1, rpe: 8 }], unit: "kg" }])]; // ~220 lb
    const justLogged: ExerciseLog[] = [{ name: "Meet Bench", sets: [{ weight: 210, reps: 1, rpe: 8 }], unit: "lb" }]; // 210 lb < 220 lb
    expect(detectNewPRs(priorLogs, justLogged)).toHaveLength(0);
  });

  it("flags a lb entry as a new PR when it actually exceeds a lighter prior kg entry", () => {
    const priorLogs = [log("2026-01-01", [{ name: "Meet Bench", sets: [{ weight: 90, reps: 1, rpe: 8 }], unit: "kg" }])]; // ~198 lb
    const justLogged: ExerciseLog[] = [{ name: "Meet Bench", sets: [{ weight: 210, reps: 1, rpe: 8 }], unit: "lb" }]; // 210 lb > 198 lb
    const result = detectNewPRs(priorLogs, justLogged);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ lift: "Meet Bench", weight: 210, unit: "lb" });
  });

  it("treats the first-ever logging of an exercise as a PR regardless of unit", () => {
    const justLogged: ExerciseLog[] = [{ name: "Overhead Press", sets: [{ weight: 60, reps: 3, rpe: 8 }], unit: "kg" }];
    const result = detectNewPRs([], justLogged);
    expect(result).toHaveLength(1);
    expect(result[0].unit).toBe("kg");
  });
});

// Regression: history was joined on the display name, so renaming an exercise in the
// program builder silently disconnected every prior performance and PR for that lift.
describe("sameExercise — identity survives a rename", () => {
  it("matches on id even when the names differ", () => {
    expect(sameExercise({ name: "Bench Press", exerciseId: "x" },
                        { name: "Competition Bench Press", exerciseId: "x" })).toBe(true);
  });

  it("does not match different ids that share a name", () => {
    expect(sameExercise({ name: "Row", exerciseId: "a" },
                        { name: "Row", exerciseId: "b" })).toBe(false);
  });

  it("falls back to the name when either side predates the catalog", () => {
    expect(sameExercise({ name: "Row" }, { name: "Row", exerciseId: "a" })).toBe(true);
    expect(sameExercise({ name: "Row" }, { name: "Chin-Up" })).toBe(false);
  });
});

describe("lastPerformanceFor — renamed exercise", () => {
  const log = (name: string, exerciseId: string, weight: number) => ({
    id: `log-${weight}`, profile_id: "c1", program_id: "p1", date: "2026-08-01",
    day_label: null, completed: true, created_at: "",
    exercises_completed: [{ name, exerciseId, unit: "lb" as const, sets: [{ reps: 5, weight, rpe: null }] }],
  });

  it("still finds history after the coach renames the exercise", () => {
    const logs = [log("Bench Press", "bench-id", 225)];
    const renamed = { name: "Competition Bench Press", exerciseId: "bench-id" };
    expect(lastPerformanceFor(logs, renamed)?.exercise.sets[0].weight).toBe(225);
  });

  it("keeps two same-named exercises apart when their ids differ", () => {
    const logs = [log("Bench Press", "volume-day-id", 185)];
    expect(lastPerformanceFor(logs, { name: "Bench Press", exerciseId: "top-single-id" })).toBeNull();
  });
});
