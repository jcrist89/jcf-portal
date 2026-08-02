import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabase } from "@/test/fakeSupabase";

const mockSupabaseForRequest = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ supabaseForRequest: () => mockSupabaseForRequest() }));
vi.mock("@/lib/push", () => ({ notifyJokerResolved: vi.fn().mockResolvedValue(undefined) }));

function fakeRequest(body: unknown) {
  return { json: async () => body } as any;
}
function session(role: "client" | "coach", id: string) {
  return { id, email: "a@b.com", role, fullName: "T", tier: "free", onboarded: true };
}

describe("PATCH /api/joker-requests/[id]", () => {
  let db: FakeSupabase;

  beforeEach(() => {
    db = new FakeSupabase({
      joker_requests: [
        { id: "jr-1", profile_id: "client-A", status: "approved", program_id: null, week_number: 6, lift: "meet_bench", top_single_weight: 300, top_single_rpe: 7, max_permitted_weight: 310, coach_response: null, actual_weight: null, actual_rpe: null, technical_result: null, requested_at: "", resolved_at: null, resolved_by: null },
      ],
    });
  });

  it("lets the owning client mark their approved joker set completed", async () => {
    mockSupabaseForRequest.mockResolvedValue({ client: db, session: session("client", "client-A") });
    const { PATCH } = await import("./route");
    const res = await PATCH(fakeRequest({ status: "completed", actualWeight: 305 }), { params: { id: "jr-1" } });
    expect(res.status).toBe(200);
    expect(db.tables.joker_requests[0].status).toBe("completed");
  });

  it("blocks a different client from resolving someone else's joker set", async () => {
    mockSupabaseForRequest.mockResolvedValue({ client: db, session: session("client", "client-B") });
    const { PATCH } = await import("./route");
    const res = await PATCH(fakeRequest({ status: "completed" }), { params: { id: "jr-1" } });
    expect(res.status).toBe(403);
    expect(db.tables.joker_requests[0].status).toBe("approved"); // unchanged
  });

  it("blocks a client from approving their own joker set", async () => {
    mockSupabaseForRequest.mockResolvedValue({ client: db, session: session("client", "client-A") });
    const { PATCH } = await import("./route");
    const res = await PATCH(fakeRequest({ status: "approved" }), { params: { id: "jr-1" } });
    expect(res.status).toBe(403);
  });

  it("lets the coach approve any joker set", async () => {
    mockSupabaseForRequest.mockResolvedValue({ client: db, session: session("coach", "coach-1") });
    const { PATCH } = await import("./route");
    const res = await PATCH(fakeRequest({ status: "approved" }), { params: { id: "jr-1" } });
    expect(res.status).toBe(200);
    expect(db.tables.joker_requests[0].status).toBe("approved");
    expect(db.tables.joker_requests[0].resolved_by).toBe("coach-1");
  });
});
