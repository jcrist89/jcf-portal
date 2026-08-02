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

describe("PATCH/DELETE /api/clients/[id]", () => {
  beforeEach(() => {
    db = new FakeSupabase({
      profiles: [
        { id: "client-1", role: "client", is_active: true, tier: "free" },
        { id: "coach-2", role: "coach", is_active: true },
      ],
    });
    mockSupabaseForRequest.mockResolvedValue({ client: db, session: coachSession() });
  });

  it("updates an allow-listed field on a real client", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(fakeRequest({ tier: "paid_programming" }), { params: { id: "client-1" } });
    expect(res.status).toBe(200);
    expect(db.tables.profiles.find((p) => p.id === "client-1")!.tier).toBe("paid_programming");
  });

  it("rejects targeting an id that isn't a client profile (e.g. another coach account)", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(fakeRequest({ tier: "paid_coaching" }), { params: { id: "coach-2" } });
    expect(res.status).toBe(404);
    expect(db.tables.profiles.find((p) => p.id === "coach-2")!.tier).toBeUndefined();
  });

  it("rejects targeting a nonexistent id", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(fakeRequest({ tier: "paid_coaching" }), { params: { id: "ghost" } });
    expect(res.status).toBe(404);
  });

  it("deactivates a real client on DELETE", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE({} as any, { params: { id: "client-1" } });
    expect(res.status).toBe(200);
    expect(db.tables.profiles.find((p) => p.id === "client-1")!.is_active).toBe(false);
  });

  it("blocks a non-coach from editing any client", async () => {
    mockSupabaseForRequest.mockResolvedValue({
      client: db,
      session: { id: "client-1", email: "a@b.com", role: "client", fullName: "A", tier: "free", onboarded: true },
    });
    const { PATCH } = await import("./route");
    const res = await PATCH(fakeRequest({ tier: "paid_coaching" }), { params: { id: "client-1" } });
    expect(res.status).toBe(403);
  });
});
