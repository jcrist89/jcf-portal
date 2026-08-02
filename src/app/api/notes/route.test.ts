import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabase } from "@/test/fakeSupabase";

const mockSupabaseForRequest = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseForRequest: () => mockSupabaseForRequest(),
}));
vi.mock("@/lib/push", () => ({ notifyNewMessage: vi.fn().mockResolvedValue(undefined) }));

function fakeRequest(body: unknown) {
  return { json: async () => body } as any;
}

function sessionFor(role: "client" | "coach", tier: string, id = "client-1") {
  return { id, email: "a@b.com", role, fullName: "Test", tier, onboarded: true };
}

describe("POST /api/notes", () => {
  let db: FakeSupabase;

  beforeEach(() => {
    db = new FakeSupabase({
      profiles: [
        { id: "client-1", role: "client", tier: "free" },
        { id: "client-coaching", role: "client", tier: "paid_coaching" },
        { id: "coach-1", role: "coach", tier: "free" },
      ],
    });
  });

  it("rejects a free-tier client trying to message the coach", async () => {
    mockSupabaseForRequest.mockResolvedValue({ client: db, session: sessionFor("client", "free", "client-1") });
    const { POST } = await import("./route");
    const res = await POST(fakeRequest({ message: "hi" }));
    expect(res.status).toBe(403);
  });

  it("rejects a Programming-tier client trying to message the coach", async () => {
    mockSupabaseForRequest.mockResolvedValue({
      client: db,
      session: sessionFor("client", "paid_programming", "client-1"),
    });
    // profile tier in DB must match session for this test's purpose
    db.tables.profiles.find((p) => p.id === "client-1")!.tier = "paid_programming";
    const { POST } = await import("./route");
    const res = await POST(fakeRequest({ message: "hi" }));
    expect(res.status).toBe(403);
  });

  it("allows a Coaching-tier client to message the coach", async () => {
    mockSupabaseForRequest.mockResolvedValue({
      client: db,
      session: sessionFor("client", "paid_coaching", "client-coaching"),
    });
    const { POST } = await import("./route");
    const res = await POST(fakeRequest({ message: "hi" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.note.message).toBe("hi");
    expect(body.note.author).toBe("client");
  });

  it("allows the coach to message any client regardless of that client's tier", async () => {
    mockSupabaseForRequest.mockResolvedValue({ client: db, session: sessionFor("coach", "free", "coach-1") });
    const { POST } = await import("./route");
    const res = await POST(fakeRequest({ message: "hey", profileId: "client-1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.note.author).toBe("coach");
    expect(body.note.profile_id).toBe("client-1");
  });
});
