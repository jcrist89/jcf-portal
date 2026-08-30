import { describe, it, expect } from "vitest";
import {
  planRoughShift,
  parseCount,
  NEAR_MAXIMAL_PERCENT,
  TECHNIQUE_PERCENT,
  type ScalableExercise,
} from "./scaling";

const ex = (over: Partial<ScalableExercise> & { position: number; name: string }): ScalableExercise => ({
  sets: "3",
  reps: "8",
  ...over,
});

/** A typical accessory day: one main lift, four accessories, nothing heavy. */
const accessoryDay: ScalableExercise[] = [
  ex({ position: 1, name: "Bench Press", sets: "4", reps: "6", percentOfTm: 75, liftKey: "bench" }),
  ex({ position: 2, name: "Close-Grip Bench", sets: "3", reps: "8" }),
  ex({ position: 3, name: "Chest-Supported Row", sets: "3", reps: "10" }),
  ex({ position: 4, name: "Landmine Press", sets: "3", reps: "12" }),
  ex({ position: 5, name: "Band Pull-Apart", sets: "3", reps: "15" }),
];

/** A peaking day: a near-maximal single on top. */
const peakingDay: ScalableExercise[] = [
  ex({ position: 1, name: "Competition Bench — Top Single", sets: "1", reps: "1", percentOfTm: 92, liftKey: "meet_bench" }),
  ex({ position: 2, name: "Competition Bench — Wave Work", sets: "3", reps: "3", percentOfTm: 87, liftKey: "meet_bench" }),
  ex({ position: 3, name: "Close-Grip Bench", sets: "3", reps: "8" }),
  ex({ position: 4, name: "Chest-Supported Row", sets: "3", reps: "10" }),
];

describe("parseCount", () => {
  it("takes the low end of a range", () => expect(parseCount("6-10")).toBe(6));
  it("falls back to 1 for a prescription with no number", () => expect(parseCount("AMRAP")).toBe(1));
  it("falls back to 1 for nothing at all", () => expect(parseCount(null)).toBe(1));
});

describe("planRoughShift — an ordinary session", () => {
  const plan = planRoughShift(accessoryDay, "bad_sleep");

  it("never drops the primary movement", () => {
    const primary = plan.exercises.find((e) => e.source.name === "Bench Press")!;
    expect(primary.action).not.toBe("drop");
    expect(primary.sets).toBe("3"); // one set off four
  });

  it("cuts a real but not token amount of work", () => {
    // A reduced session the client can finish and feel good about — not 25% of one.
    expect(plan.volumeReductionPct).toBeGreaterThanOrEqual(30);
    expect(plan.volumeReductionPct).toBeLessThanOrEqual(60);
  });

  it("leaves most of the session standing", () => {
    const kept = plan.exercises.filter((e) => e.action !== "drop");
    expect(kept.length).toBeGreaterThanOrEqual(3);
  });

  it("drops accessories rather than the main lift", () => {
    const dropped = plan.exercises.filter((e) => e.action === "drop").map((e) => e.source.name);
    expect(dropped.length).toBeGreaterThan(0);
    expect(dropped).not.toContain("Bench Press");
  });

  it("never touches the load on a sub-maximal day", () => {
    const primary = plan.exercises.find((e) => e.source.name === "Bench Press")!;
    expect(primary.percentOfTm).toBe(75);
  });

  it("explains every exercise in plain words", () => {
    for (const e of plan.exercises) expect(e.note.length).toBeGreaterThan(0);
  });

  it("tells the client it still counts", () => {
    expect(plan.summary).toContain("still counts");
  });

  it("carries the reason through", () => {
    expect(plan.reason).toBe("bad_sleep");
  });
});

describe("planRoughShift — safety on a near-maximal day", () => {
  const plan = planRoughShift(peakingDay, "bad_sleep");

  it("recognises the session as near-maximal", () => {
    expect(plan.nearMaximal).toBe(true);
  });

  it("does NOT reduce a near-maximal load by a percentage", () => {
    // The whole safety rule: 92% scaled down "by 40%" is still a number nobody should
    // grind on no sleep. It drops to an explicit technique ceiling instead.
    const top = plan.exercises.find((e) => e.source.name.includes("Top Single"))!;
    expect(top.action).toBe("technique");
    expect(top.percentOfTm).toBe(TECHNIQUE_PERCENT);
    expect(top.percentOfTm).toBeLessThan(NEAR_MAXIMAL_PERCENT);
  });

  it("keeps the movement rather than cancelling the session", () => {
    const top = plan.exercises.find((e) => e.source.name.includes("Top Single"))!;
    expect(top.action).not.toBe("drop");
    expect(top.sets).toBe("2");
  });

  it("drops the accessories", () => {
    expect(plan.exercises.find((e) => e.source.name === "Chest-Supported Row")!.action).toBe("drop");
  });

  it("says why the session changed shape, not just size", () => {
    expect(plan.safetyNote).toContain("takes the load off");
  });

  it("treats exactly 85% as near-maximal", () => {
    const atThreshold = [ex({ position: 1, name: "Squat", percentOfTm: NEAR_MAXIMAL_PERCENT, liftKey: "squat" })];
    expect(planRoughShift(atThreshold).nearMaximal).toBe(true);
  });

  it("treats 84% as ordinary", () => {
    const below = [ex({ position: 1, name: "Squat", percentOfTm: 84, liftKey: "squat" })];
    expect(planRoughShift(below).nearMaximal).toBe(false);
  });
});

describe("planRoughShift — a coach-authored variant wins", () => {
  const authored: ScalableExercise[] = [
    ex({
      position: 1, name: "Competition Bench — Top Single", sets: "1", reps: "1",
      percentOfTm: 92, liftKey: "meet_bench", scaledSets: "3", scaledReps: "3",
    }),
    ex({ position: 2, name: "Chest-Supported Row", sets: "3", reps: "10" }),
  ];
  const plan = planRoughShift(authored, "low_energy");

  it("uses what the coach wrote, even on a near-maximal day", () => {
    expect(plan.usedAuthoredVariant).toBe(true);
    const top = plan.exercises[0];
    expect(top.sets).toBe("3");
    expect(top.reps).toBe("3");
    expect(top.note).toContain("Jon's");
  });

  it("does not apply the technique ceiling over the coach's own decision", () => {
    expect(plan.exercises[0].percentOfTm).toBe(92);
    expect(plan.safetyNote).toBeNull();
  });
});

describe("planRoughShift — priority", () => {
  it("respects an explicit priority 1 over the inferred primary", () => {
    const tagged: ScalableExercise[] = [
      ex({ position: 1, name: "Warm-up Bike", sets: "1", reps: "10" }),
      ex({ position: 2, name: "Squat", sets: "5", reps: "5", priority: 1 }),
      ex({ position: 3, name: "Curl", sets: "3", reps: "12" }),
    ];
    const plan = planRoughShift(tagged);
    expect(plan.exercises.find((e) => e.source.name === "Squat")!.action).not.toBe("drop");
  });

  it("drops the highest priority numbers first", () => {
    const tagged: ScalableExercise[] = [
      ex({ position: 1, name: "Squat", sets: "4", reps: "5", priority: 1 }),
      ex({ position: 2, name: "Leg Press", sets: "3", reps: "10", priority: 2 }),
      ex({ position: 3, name: "Calf Raise", sets: "3", reps: "15", priority: 3 }),
    ];
    const plan = planRoughShift(tagged);
    expect(plan.exercises.find((e) => e.source.name === "Calf Raise")!.action).toBe("drop");
  });
});

describe("planRoughShift — degenerate sessions", () => {
  it("handles an empty session", () => {
    const plan = planRoughShift([]);
    expect(plan.exercises).toEqual([]);
    expect(plan.volumeReductionPct).toBe(0);
  });

  it("keeps a single-exercise session doing something", () => {
    const plan = planRoughShift([ex({ position: 1, name: "Squat", sets: "5", reps: "5" })]);
    const only = plan.exercises[0];
    expect(only.action).not.toBe("drop");
    expect(only.sets).toBe("4");
  });

  it("never reduces a single set below one", () => {
    const plan = planRoughShift([
      ex({ position: 1, name: "Squat", sets: "1", reps: "5" }),
      ex({ position: 2, name: "Curl", sets: "1", reps: "10" }),
    ]);
    for (const e of plan.exercises) {
      if (e.action !== "drop") expect(parseCount(e.sets)).toBeGreaterThanOrEqual(1);
    }
  });

  it("copes with unparseable prescriptions", () => {
    const plan = planRoughShift([
      ex({ position: 1, name: "Sled Push", sets: "AMRAP", reps: "to failure" }),
      ex({ position: 2, name: "Carry", sets: "x", reps: "60s" }),
    ]);
    expect(plan.exercises).toHaveLength(2);
    expect(Number.isFinite(plan.volumeReductionPct)).toBe(true);
  });
});
