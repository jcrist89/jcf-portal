import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabase } from "@/test/fakeSupabase";

const mockSupabaseForRequest = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseForRequest: () => mockSupabaseForRequest(),
}));

function fakeRequest(body: unknown) {
  return { json: async () => body } as any;
}
function fakeGetRequest(qs: string) {
  return { url: `https://x.test/api/drafts?${qs}` } as any;
}

const session = { id: "client-1", email: "a@b.com", role: "client" as const, fullName: "A", tier: "free", onboarded: true };

describe("workout draft save/resume/discard", () => {
  let db: FakeSupabase;

  beforeEach(() => {
    db = new FakeSupabase({ form_drafts: [] });
    mockSupabaseForRequest.mockResolvedValue({ client: db, session });
  });

  it("saves a draft, then resumes it on GET", async () => {
    const { POST, GET } = await import("./route");
    const saveRes = await POST(fakeRequest({ formType: "workout", draftKey: "day-1", payload: { sets: [{ reps: 5, weight: 225 }] } }));
    expect(saveRes.status).toBe(200);

    const getRes = await GET(fakeGetRequest("formType=workout&draftKey=day-1"));
    const body = await getRes.json();
    expect(body.draft.payload).toEqual({ sets: [{ reps: 5, weight: 225 }] });
  });

  it("overwrites (not duplicates) a draft saved twice under the same key", async () => {
    const { POST, GET } = await import("./route");
    await POST(fakeRequest({ formType: "workout", draftKey: "day-1", payload: { sets: [1] } }));
    await POST(fakeRequest({ formType: "workout", draftKey: "day-1", payload: { sets: [1, 2] } }));
    expect(db.tables.form_drafts.filter((d) => d.draft_key === "day-1")).toHaveLength(1);

    const getRes = await GET(fakeGetRequest("formType=workout&draftKey=day-1"));
    const body = await getRes.json();
    expect(body.draft.payload).toEqual({ sets: [1, 2] });
  });

  it("returns null for a draft that was never saved", async () => {
    const { GET } = await import("./route");
    const res = await GET(fakeGetRequest("formType=measurement&draftKey=none"));
    const body = await res.json();
    expect(body.draft).toBeNull();
  });

  it("removes the draft on confirmed submit (DELETE)", async () => {
    const { POST, GET, DELETE } = await import("./route");
    await POST(fakeRequest({ formType: "pr", draftKey: "squat", payload: { weight: 405 } }));
    const del = await DELETE(fakeRequest({ formType: "pr", draftKey: "squat" }));
    expect(del.status).toBe(200);
    const getRes = await GET(fakeGetRequest("formType=pr&draftKey=squat"));
    const body = await getRes.json();
    expect(body.draft).toBeNull();
  });

  it("scopes drafts to the caller's own profile_id", async () => {
    db.tables.form_drafts.push({ id: "d1", profile_id: "someone-else", form_type: "workout", draft_key: "day-1", payload: { foo: "bar" }, updated_at: "" });
    const { GET } = await import("./route");
    const res = await GET(fakeGetRequest("formType=workout&draftKey=day-1"));
    const body = await res.json();
    expect(body.draft).toBeNull(); // doesn't see another profile's draft under the same key
  });
});
