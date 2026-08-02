import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabase } from "@/test/fakeSupabase";

const mockSupabaseForRequest = vi.fn();
let db: FakeSupabase;
vi.mock("@/lib/supabase/server", () => ({ supabaseForRequest: () => mockSupabaseForRequest() }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => db }));

function fakeRequest(body: unknown) {
  return { json: async () => body } as any;
}
function coachSession() {
  return { id: "coach-1", email: "c@b.com", role: "coach" as const, fullName: "Coach", tier: "free", onboarded: true };
}

describe("PATCH /api/training-maxes", () => {
  beforeEach(() => {
    db = new FakeSupabase({
      profiles: [
        { id: "client-1", role: "client" },
        { id: "coach-1", role: "coach" },
      ],
      training_maxes: [],
    });
    mockSupabaseForRequest.mockResolvedValue({ client: db, session: coachSession() });
  });

  it("rejects a non-coach caller", async () => {
    mockSupabaseForRequest.mockResolvedValue({
      client: db,
      session: { id: "client-1", email: "a@b.com", role: "client", fullName: "A", tier: "free", onboarded: true },
    });
    const { PATCH } = await import("./route");
    const res = await PATCH(fakeRequest({ profileId: "client-1", lift: "meet_bench", oneRm: 300 }));
    expect(res.status).toBe(403);
  });

  it("rejects a profileId that doesn't belong to a real client profile", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(fakeRequest({ profileId: "does-not-exist", lift: "meet_bench", oneRm: 300 }));
    expect(res.status).toBe(404);
    expect(db.tables.training_maxes).toHaveLength(0);
  });

  it("rejects targeting a coach's own profile id as if it were a client", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(fakeRequest({ profileId: "coach-1", lift: "meet_bench", oneRm: 300 }));
    expect(res.status).toBe(404);
  });

  it("upserts a training max for a real client", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(fakeRequest({ profileId: "client-1", lift: "meet_bench", oneRm: 300, unit: "kg" }));
    expect(res.status).toBe(200);
    expect(db.tables.training_maxes).toHaveLength(1);
    expect(db.tables.training_maxes[0].profile_id).toBe("client-1");
  });
});
