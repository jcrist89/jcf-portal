import { describe, expect, it } from "vitest";
import type { WorkoutLog } from "@/lib/types";
import { maxRepTarget, parseRestSeconds, progressionRecommendation, warmupSets } from "./workoutGuidance";

function log(sets: Array<{ weight: number; reps: number }>): WorkoutLog {
  return {
    id: "log-1", profile_id: "client", program_id: "program", date: "2026-09-01", day_label: "Upper",
    completed: true, created_at: "", exercises_completed: [{ name: "Dumbbell Press", unit: "lb", sets: sets.map((set) => ({ ...set, rpe: null })) }],
  };
}

const exercise = { name: "Dumbbell Press", sets: 3, reps: "8-12", rest: "90 sec", unit: "lb" as const };

describe("progressionRecommendation", () => {
  it("adds 5% and rounds to practical equipment increments after every set hits the max rep target", () => {
    expect(progressionRecommendation([log([{ weight: 50, reps: 12 }, { weight: 50, reps: 12 }, { weight: 50, reps: 12 }])], exercise))
      .toMatchObject({ weight: 55, unit: "lb", progressed: true });
  });

  it("holds the load when one set misses the top of the range", () => {
    expect(progressionRecommendation([log([{ weight: 50, reps: 12 }, { weight: 50, reps: 11 }, { weight: 50, reps: 12 }])], exercise))
      .toMatchObject({ weight: 50, progressed: false });
  });

  it("does not auto-progress ramping sets", () => {
    expect(progressionRecommendation([log([{ weight: 40, reps: 12 }, { weight: 45, reps: 12 }, { weight: 50, reps: 12 }])], exercise))
      .toMatchObject({ weight: null, progressed: false });
  });
});

describe("workout guidance parsing", () => {
  it("parses rep ranges and rest ranges", () => {
    expect(maxRepTarget("10-12 each side")).toBe(12);
    expect(maxRepTarget("30 sec")).toBeNull();
    expect(parseRestSeconds("90 sec")).toBe(90);
    expect(parseRestSeconds("2-3 min")).toBe(180);
  });

  it("creates practical warm-up sets", () => {
    expect(warmupSets(100, "lb")).toEqual([
      { weight: 40, reps: 8 }, { weight: 60, reps: 5 }, { weight: 80, reps: 3 },
    ]);
  });
});
