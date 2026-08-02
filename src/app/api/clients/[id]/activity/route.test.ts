import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabase } from "@/test/fakeSupabase";

const mockSupabaseForRequest = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ supabaseForRequest: () => mockSupabaseForRequest() }));

function fakeRequest(qs = "") {
  return { url: `https://x.test/api/clients/c1/activity${qs}` } as any;
}

describe("GET /api/clients/[id]/activity", () => {
  let db: FakeSupabase;

  beforeEach(() => {
    db = new FakeSupabase({
      workout_logs: [{ id: "w1", profile_id: "c1", date: "2026-01-01", day_label: "Day 1", completed: true, created_at: "2026-01-01T10:00:00Z" }],
      measurements: [],
      prs: [],
      achievements: [],
      readiness_checkins: [],
      joker_requests: [],
      coach_notes: [],
    });
  });

  it("rejects a client caller, even requesting their own id", async () => {
    mockSupabaseForRequest.mockResolvedValue({
      client: db,
      session: { id: "c1", email: "a@b.com", role: "client", fullName: "A", tier: "free", onboarded: true },
    });
    const { GET } = await import("./route");
    const res = await GET(fakeRequest(), { params: { id: "c1" } });
    expect(res.status).toBe(403);
  });

  it("lets a coach fetch a client's activity feed", async () => {
    mockSupabaseForRequest.mockResolvedValue({
      client: db,
      session: { id: "coach-1", email: "c@b.com", role: "coach", fullName: "Coach", tier: "free", onboarded: true },
    });
    const { GET } = await import("./route");
    const res = await GET(fakeRequest(), { params: { id: "c1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toHaveLength(1);
  });
});
