import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabase } from "@/test/fakeSupabase";

const mockSupabaseForRequest = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ supabaseForRequest: () => mockSupabaseForRequest() }));
vi.mock("@/lib/push", () => ({ notifyDeviationReported: vi.fn().mockResolvedValue(undefined) }));

function fakeRequest(body: unknown) {
  return { json: async () => body } as any;
}
const session = { id: "client-1", email: "a@b.com", role: "client" as const, fullName: "A", tier: "free", onboarded: true, timezone: "America/Toronto" };
const profile = { id: "client-1", timezone: "America/Toronto" };

describe("POST /api/workouts — training max hit/miss adjustment", () => {
  let db: FakeSupabase;

  beforeEach(() => {
    db = new FakeSupabase({
      workout_logs: [],
      prs: [],
      training_maxes: [{ id: "tm-1", profile_id: "client-1", lift: "bench", weight: 225, updated_at: "" }],
      deviation_reports: [],
      achievements: [],
      measurements: [],
    });
    mockSupabaseForRequest.mockResolvedValue({ client: db, session, profile });
  });

  it("bumps the training max ~4% on a hit", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      fakeRequest({
        dayLabel: "Day 1",
        exercisesCompleted: [],
        trainingMaxAdjustments: [{ lift: "bench", hit: true }],
      }),
    );
    expect(res.status).toBe(200);
    expect(db.tables.training_maxes[0].weight).toBe(235); // 225 * 1.04 = 234 -> nearest 5
  });

  it("holds the training max flat on a miss", async () => {
    const { POST } = await import("./route");
    await POST(
      fakeRequest({
        dayLabel: "Day 1",
        exercisesCompleted: [],
        trainingMaxAdjustments: [{ lift: "bench", hit: false }],
      }),
    );
    expect(db.tables.training_maxes[0].weight).toBe(225);
  });

  it("saves the workout log itself regardless of any TM adjustment", async () => {
    const { POST } = await import("./route");
    const res = await POST(fakeRequest({ dayLabel: "Day 2", exercisesCompleted: [{ name: "Squat", sets: [{ reps: 5, weight: 315, rpe: 8 }] }] }));
    const body = await res.json();
    expect(body.workoutLog.day_label).toBe("Day 2");
    expect(db.tables.workout_logs).toHaveLength(1);
  });

  it("ignores an adjustment for a lift with no existing training max row", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      fakeRequest({ dayLabel: "Day 1", exercisesCompleted: [], trainingMaxAdjustments: [{ lift: "squat", hit: true }] }),
    );
    expect(res.status).toBe(200);
    expect(db.tables.training_maxes).toHaveLength(1); // unchanged, no row created
  });
});
