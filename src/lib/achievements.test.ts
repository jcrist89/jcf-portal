import { describe, it, expect } from "vitest";
import {
  checkFirstWorkout,
  checkWorkoutMilestones,
  checkStreaks,
  checkPrHit,
  checkGoalMilestone,
  runAchievementChecks,
  type AchievementContext,
} from "./achievements";
import type { Profile, WorkoutLog, PR, Measurement } from "@/lib/types";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "p1",
    role: "client",
    username: null,
    email: "a@b.com",
    full_name: "Test Client",
    birthday: null,
    height_in: null,
    starting_weight: 200,
    current_weight: 200,
    goal: "strength_gain",
    program_id: null,
    tier: "free",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: "n/a",
    is_active: true,
    onboarded: true,
    welcome_email_sent_at: null,
    last_nudge_threshold: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function workout(date: string, completed = true): WorkoutLog {
  return { id: `w-${date}`, profile_id: "p1", program_id: null, date, day_label: null, exercises_completed: [], completed, created_at: "" };
}

function pr(overrides: Partial<PR>): PR {
  return { id: "pr1", profile_id: "p1", lift: "squat", weight: 100, unit: "lb", reps: 1, date: "2026-01-01", notes: null, created_at: "", ...overrides };
}

function baseCtx(overrides: Partial<AchievementContext> = {}): AchievementContext {
  return { profile: profile(), existing: [], workoutLogs: [], measurements: [], prs: [], ...overrides };
}

describe("checkFirstWorkout", () => {
  it("awards on the first completed workout", () => {
    const result = checkFirstWorkout(baseCtx({ workoutLogs: [workout("2026-01-01")] }));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("first_workout");
  });

  it("does not re-award if already earned", () => {
    const result = checkFirstWorkout(
      baseCtx({ workoutLogs: [workout("2026-01-01")], existing: [{ id: "a1", profile_id: "p1", type: "first_workout", title: "", description: null, date_earned: "", icon: null, created_at: "" }] })
    );
    expect(result).toHaveLength(0);
  });

  it("does not award for zero completed workouts", () => {
    expect(checkFirstWorkout(baseCtx({ workoutLogs: [workout("2026-01-01", false)] }))).toHaveLength(0);
  });
});

describe("checkWorkoutMilestones", () => {
  it("awards the 10-workout milestone at exactly 10 completed logs", () => {
    const logs = Array.from({ length: 10 }, (_, i) => workout(`2026-01-${String(i + 1).padStart(2, "0")}`));
    const result = checkWorkoutMilestones(baseCtx({ workoutLogs: logs }));
    expect(result.map((r) => r.type)).toContain("workouts_10");
    expect(result.map((r) => r.type)).not.toContain("workouts_25");
  });

  it("awards multiple milestones at once if crossed together", () => {
    const logs = Array.from({ length: 25 }, (_, i) => workout(`2026-${String((i % 12) + 1).padStart(2, "0")}-01`));
    const result = checkWorkoutMilestones(baseCtx({ workoutLogs: logs }));
    expect(result.map((r) => r.type).sort()).toEqual(["workouts_10", "workouts_25"]);
  });
});

describe("checkStreaks", () => {
  it("does not award below a 4-week run", () => {
    const logs = [workout("2026-01-05"), workout("2026-01-12")]; // 2 consecutive weeks
    expect(checkStreaks(baseCtx({ workoutLogs: logs }))).toHaveLength(0);
  });

  it("awards a 4-week streak for 4 consecutive weeks with >=1 log each", () => {
    const logs = [workout("2026-01-05"), workout("2026-01-12"), workout("2026-01-19"), workout("2026-01-26")];
    const result = checkStreaks(baseCtx({ workoutLogs: logs }));
    expect(result.map((r) => r.type)).toContain("streak_4_weeks");
  });

  it("does not count a gap week toward the streak", () => {
    // week 1, week 2, (gap), week 4 -- longest run is 2, not 3
    const logs = [workout("2026-01-05"), workout("2026-01-12"), workout("2026-01-26")];
    expect(checkStreaks(baseCtx({ workoutLogs: logs }))).toHaveLength(0);
  });
});

describe("checkPrHit", () => {
  it("awards when the new PR beats the prior best for that lift", () => {
    const ctx = baseCtx({ prs: [pr({ id: "old", weight: 90 })] });
    const result = checkPrHit(ctx, pr({ id: "new", weight: 100 }));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("pr_hit");
  });

  it("does not award when it doesn't beat the prior best", () => {
    const ctx = baseCtx({ prs: [pr({ id: "old", weight: 110 })] });
    expect(checkPrHit(ctx, pr({ id: "new", weight: 100 }))).toHaveLength(0);
  });

  it("is scoped per lift — a squat PR doesn't compare against a bench PR", () => {
    const ctx = baseCtx({ prs: [pr({ id: "old", lift: "bench", weight: 500 })] });
    const result = checkPrHit(ctx, pr({ id: "new", lift: "squat", weight: 100 }));
    expect(result).toHaveLength(1);
  });

  it("does not award when a smaller-looking lb number doesn't actually beat a heavier kg PR", () => {
    // 100 kg (~220 lb) prior best; a new 210 lb entry is a bigger raw number but
    // still lighter than the true prior best once converted.
    const ctx = baseCtx({ prs: [pr({ id: "old", lift: "meet_bench", weight: 100, unit: "kg" })] });
    const result = checkPrHit(ctx, pr({ id: "new", lift: "meet_bench", weight: 210, unit: "lb" }));
    expect(result).toHaveLength(0);
  });

  it("awards when a kg entry genuinely beats a prior lb best", () => {
    // 90 kg (~198 lb) beats a 190 lb prior best
    const ctx = baseCtx({ prs: [pr({ id: "old", lift: "meet_bench", weight: 190, unit: "lb" })] });
    const result = checkPrHit(ctx, pr({ id: "new", lift: "meet_bench", weight: 90, unit: "kg" }));
    expect(result).toHaveLength(1);
  });
});

describe("checkGoalMilestone", () => {
  it("awards the fat-loss milestone at -10 lb from starting weight", () => {
    const ctx = baseCtx({ profile: profile({ goal: "fat_loss", starting_weight: 200, current_weight: 189 }) });
    expect(checkGoalMilestone(ctx)).toHaveLength(1);
  });

  it("does not award fat-loss milestone before -10 lb", () => {
    const ctx = baseCtx({ profile: profile({ goal: "fat_loss", starting_weight: 200, current_weight: 195 }) });
    expect(checkGoalMilestone(ctx)).toHaveLength(0);
  });

  it("awards the powerlifting total milestone at 1000+ combined (same-unit PRs)", () => {
    const ctx = baseCtx({
      profile: profile({ goal: "powerlifting" }),
      prs: [pr({ id: "s", lift: "squat", weight: 400 }), pr({ id: "b", lift: "bench", weight: 300 }), pr({ id: "d", lift: "deadlift", weight: 400 })],
    });
    expect(checkGoalMilestone(ctx)).toHaveLength(1);
  });

  it("correctly converts a kg-logged lift before summing into the combined total", () => {
    // 400 lb squat + 300 lb bench + 200 kg (~440.9 lb) deadlift = ~1140.9 lb, well over 1000
    const ctx = baseCtx({
      profile: profile({ goal: "powerlifting" }),
      prs: [
        pr({ id: "s", lift: "squat", weight: 400, unit: "lb" }),
        pr({ id: "b", lift: "bench", weight: 300, unit: "lb" }),
        pr({ id: "d", lift: "deadlift", weight: 200, unit: "kg" }),
      ],
    });
    const result = checkGoalMilestone(ctx);
    expect(result).toHaveLength(1);
    expect(result[0].description).toMatch(/^114\d lb combined/); // ~1141 lb, not a raw 900
  });

  it("does not award the powerlifting total from a raw (unconverted) sum that would incorrectly hit 1000 in mixed units", () => {
    // Raw sum without conversion (200+300+400 = 900) is under 1000, but if a
    // kg value were wrongly treated as lb the total would be understated, not
    // overstated — this case instead checks the opposite risk stays fixed too:
    // three PRs whose raw numbers sum under 1000 but whose true (converted) lb
    // total is still under 1000, so no milestone should fire.
    const ctx = baseCtx({
      profile: profile({ goal: "powerlifting" }),
      prs: [
        pr({ id: "s", lift: "squat", weight: 300, unit: "lb" }),
        pr({ id: "b", lift: "bench", weight: 200, unit: "lb" }),
        pr({ id: "d", lift: "deadlift", weight: 100, unit: "kg" }), // ~220 lb
      ],
    });
    expect(checkGoalMilestone(ctx)).toHaveLength(0); // 300+200+220 = 720, correctly under 1000
  });

  it("awards the strength-gain milestone at 1.5x bodyweight", () => {
    const ctx = baseCtx({
      profile: profile({ goal: "strength_gain", current_weight: 200 }),
      prs: [pr({ id: "s", lift: "squat", weight: 300 })],
    });
    expect(checkGoalMilestone(ctx)).toHaveLength(1);
  });

  it("awards the hybrid milestone at 15 completed workouts", () => {
    const logs = Array.from({ length: 15 }, (_, i) => workout(`2026-01-${String((i % 28) + 1).padStart(2, "0")}`));
    const ctx = baseCtx({ profile: profile({ goal: "hybrid" }), workoutLogs: logs });
    expect(checkGoalMilestone(ctx)).toHaveLength(1);
  });
});

describe("runAchievementChecks", () => {
  it("de-dupes one-time badge types but keeps every pr_hit", () => {
    const ctx = baseCtx({
      workoutLogs: [workout("2026-01-01")],
      prs: [pr({ id: "old-squat", lift: "squat", weight: 90 }), pr({ id: "old-bench", lift: "bench", weight: 90 })],
    });
    const newSquat = pr({ id: "new-squat", lift: "squat", weight: 100 });
    const newBench = pr({ id: "new-bench", lift: "bench", weight: 100 });
    const result = runAchievementChecks(ctx, { newPrs: [newSquat, newBench] });
    const prHits = result.filter((r) => r.type === "pr_hit");
    expect(prHits).toHaveLength(2); // both lifts get their own badge
    const firstWorkoutHits = result.filter((r) => r.type === "first_workout");
    expect(firstWorkoutHits).toHaveLength(1); // one-time badge, not duplicated
  });
});
