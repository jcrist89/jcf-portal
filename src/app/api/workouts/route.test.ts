import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabase } from "@/test/fakeSupabase";

const mockSupabaseForRequest = vi.fn();
let db: FakeSupabase;
vi.mock("@/lib/supabase/server", () => ({ supabaseForRequest: () => mockSupabaseForRequest() }));
vi.mock("@/lib/push", () => ({ notifyDeviationReported: vi.fn().mockResolvedValue(undefined) }));
// completeScheduledSession and logEvent both write through the service-role client.
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => db }));

function fakeRequest(body: unknown) {
  return { json: async () => body } as any;
}
const session = { id: "client-1", email: "a@b.com", role: "client" as const, fullName: "A", tier: "free", onboarded: true, timezone: "America/Toronto" };
const profile = { id: "client-1", timezone: "America/Toronto" };

describe("POST /api/workouts — training max hit/miss adjustment", () => {

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

// Rough Shift's whole promise: a reduced session is recorded as done, not skipped.
describe("POST /api/workouts — Rough Shift closes the session as scaled", () => {
  function seedWithSession(status = "prescribed") {
    db = new FakeSupabase({
      workout_logs: [],
      prs: [],
      training_maxes: [],
      deviation_reports: [],
      achievements: [],
      measurements: [],
      assignment_sessions: [
        { id: "sess-1", profile_id: "client-1", assignment_id: "a1", status,
          workout_log_id: null, completed_on: null, scaling_mode: null, scaling_reason: null },
        { id: "sess-other", profile_id: "client-2", assignment_id: "a2", status: "prescribed",
          workout_log_id: null, completed_on: null, scaling_mode: null, scaling_reason: null },
      ],
    });
    mockSupabaseForRequest.mockResolvedValue({ client: db, session, profile });
  }

  it("marks the session scaled and records why", async () => {
    seedWithSession();
    const { POST } = await import("./route");
    const res = await POST(
      fakeRequest({
        assignmentSessionId: "sess-1",
        dayLabel: "Week 1 — Day 1",
        exercisesCompleted: [],
        completed: true,
        scalingMode: "rough_shift",
        scalingReason: "bad_sleep",
      }),
    );
    expect(res.status).toBe(200);

    const s = db.tables.assignment_sessions.find((x) => x.id === "sess-1")!;
    expect(s.status).toBe("scaled");
    expect(s.scaling_mode).toBe("rough_shift");
    expect(s.scaling_reason).toBe("bad_sleep");
    expect(s.workout_log_id).toBeTruthy();
  });

  it("marks it completed when no scaling was used", async () => {
    seedWithSession();
    const { POST } = await import("./route");
    await POST(
      fakeRequest({ assignmentSessionId: "sess-1", exercisesCompleted: [], completed: true }),
    );
    const s = db.tables.assignment_sessions.find((x) => x.id === "sess-1")!;
    expect(s.status).toBe("completed");
    expect(s.scaling_mode).toBeNull();
  });

  it("never counts a scaled session as skipped", async () => {
    seedWithSession();
    const { POST } = await import("./route");
    await POST(
      fakeRequest({
        assignmentSessionId: "sess-1", exercisesCompleted: [], completed: true,
        scalingMode: "rough_shift", scalingReason: "pain",
      }),
    );
    expect(db.tables.assignment_sessions.find((x) => x.id === "sess-1")!.status).not.toBe("skipped");
  });

  it("cannot close another client's session by guessing its id", async () => {
    seedWithSession();
    const { POST } = await import("./route");
    await POST(
      fakeRequest({ assignmentSessionId: "sess-other", exercisesCompleted: [], completed: true }),
    );
    expect(db.tables.assignment_sessions.find((x) => x.id === "sess-other")!.status).toBe("prescribed");
  });

  it("does not rewrite a session that was already resolved", async () => {
    seedWithSession("completed");
    db.tables.assignment_sessions[0].scaling_mode = null;
    const { POST } = await import("./route");
    await POST(
      fakeRequest({
        assignmentSessionId: "sess-1", exercisesCompleted: [], completed: true,
        scalingMode: "rough_shift", scalingReason: "pain",
      }),
    );
    const s = db.tables.assignment_sessions.find((x) => x.id === "sess-1")!;
    expect(s.status).toBe("completed");
    expect(s.scaling_mode).toBeNull();
  });
});
