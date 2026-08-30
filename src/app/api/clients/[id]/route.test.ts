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

function seed() {
    db = new FakeSupabase({
      profiles: [
        { id: "client-1", role: "client", is_active: true, tier: "free", timezone: "America/Toronto" },
        { id: "coach-2", role: "coach", is_active: true, timezone: "America/Toronto" },
      ],
      programs: [
        {
          id: "tmpl-1", goal: "hybrid", name: "Duty-Ready Build", description: "d",
          structure: { weeks: [{ week: 1, days: [{ day: 1, label: "A", exercises: [] }] }] },
          is_template: true, is_default_template: false, client_id: null,
          meet_date: null, attempt_plan: null, weaknesses: null,
        },
        {
          id: "meet-tmpl", goal: "powerlifting", name: "Meet Prep", description: "d",
          structure: { weeks: [{ week: 1, days: [{ day: 1, label: "A", exercises: [] }] }] },
          is_template: true, is_default_template: false, client_id: null,
          meet_date: "2026-10-31", attempt_plan: null, weaknesses: null,
        },
        {
          id: "owned-1", goal: "hybrid", name: "Owned", description: "d",
          structure: { weeks: [] }, is_template: false, is_default_template: false,
          client_id: "client-1", meet_date: null, attempt_plan: null, weaknesses: null,
        },
        {
          id: "someone-else", goal: "hybrid", name: "Theirs", description: "d",
          structure: { weeks: [] }, is_template: false, is_default_template: false,
          client_id: "other-client", meet_date: null, attempt_plan: null, weaknesses: null,
        },
      ],
      program_assignments: [],
      assignment_sessions: [],
      client_engagements: [],
    }).stubRpc("materialize_assignment_sessions", () => 16);
    mockSupabaseForRequest.mockResolvedValue({ client: db, session: coachSession() });
  }

describe("PATCH/DELETE /api/clients/[id]", () => {
  beforeEach(seed);

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

// Regression: the coach's "Swap Program Template" control sent the template id
// straight through, pointing the client at a shared row. Editing that client's
// program then rewrote the template every future client is copied from.
describe("PATCH /api/clients/[id] — program assignment always copies", () => {
  beforeEach(seed);

  it("never leaves a client pointing at a shared template", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(fakeRequest({ program_id: "tmpl-1" }), { params: { id: "client-1" } });
    expect(res.status).toBe(200);

    const assignedId = db.tables.profiles.find((p) => p.id === "client-1")!.program_id;
    expect(assignedId).not.toBe("tmpl-1");

    const assigned = db.tables.programs.find((p) => p.id === assignedId)!;
    expect(assigned.is_template).toBe(false);
    expect(assigned.client_id).toBe("client-1");
    expect(assigned.structure).toEqual(
      db.tables.programs.find((p) => p.id === "tmpl-1")!.structure,
    );
  });

  it("leaves the shared template untouched", async () => {
    const { PATCH } = await import("./route");
    await PATCH(fakeRequest({ program_id: "tmpl-1" }), { params: { id: "client-1" } });
    const template = db.tables.programs.find((p) => p.id === "tmpl-1")!;
    expect(template.is_template).toBe(true);
    expect(template.client_id).toBeNull();
  });

  it("anchors the copy to a start date so program position is calendar-aware", async () => {
    const { PATCH } = await import("./route");
    await PATCH(fakeRequest({ program_id: "tmpl-1" }), { params: { id: "client-1" } });
    const assignedId = db.tables.profiles.find((p) => p.id === "client-1")!.program_id;
    const assigned = db.tables.programs.find((p) => p.id === assignedId)!;
    expect(assigned.starts_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(assigned.schedule_mode).toBe("sequential");
  });

  it("marks a copy of a meet-dated template as date-anchored", async () => {
    const { PATCH } = await import("./route");
    await PATCH(fakeRequest({ program_id: "meet-tmpl" }), { params: { id: "client-1" } });
    const assignedId = db.tables.profiles.find((p) => p.id === "client-1")!.program_id;
    expect(db.tables.programs.find((p) => p.id === assignedId)!.schedule_mode).toBe("date_anchored");
  });

  it("does not spawn a duplicate when re-saving the client's own program", async () => {
    const { PATCH } = await import("./route");
    const before = db.tables.programs.length;
    const res = await PATCH(fakeRequest({ program_id: "owned-1" }), { params: { id: "client-1" } });
    expect(res.status).toBe(200);
    expect(db.tables.programs).toHaveLength(before);
    expect(db.tables.profiles.find((p) => p.id === "client-1")!.program_id).toBe("owned-1");
  });

  it("refuses to assign another client's program", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(fakeRequest({ program_id: "someone-else" }), { params: { id: "client-1" } });
    expect(res.status).toBe(403);
  });

  it("404s on a program that does not exist", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(fakeRequest({ program_id: "nope" }), { params: { id: "client-1" } });
    expect(res.status).toBe(404);
  });
});

// A program with no assignment has no schedule, so the client would open the app and
// see nothing to do. Assigning one has to produce both.
describe("PATCH /api/clients/[id] — assignment follows the program", () => {
  beforeEach(seed);

  it("creates a calendar-aware assignment alongside the program copy", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(fakeRequest({ program_id: "tmpl-1" }), { params: { id: "client-1" } });
    expect(res.status).toBe(200);

    const assignment = db.tables.program_assignments.find((a) => a.profile_id === "client-1");
    expect(assignment).toBeDefined();
    expect(assignment!.status).toBe("active");
    expect(assignment!.schedule_mode).toBe("sequential");
    expect(assignment!.program_id).toBe(
      db.tables.profiles.find((p) => p.id === "client-1")!.program_id,
    );
  });

  it("carries date-anchoring onto the assignment for a meet block", async () => {
    const { PATCH } = await import("./route");
    await PATCH(fakeRequest({ program_id: "meet-tmpl" }), { params: { id: "client-1" } });
    const assignment = db.tables.program_assignments.find((a) => a.profile_id === "client-1");
    expect(assignment!.schedule_mode).toBe("date_anchored");
  });

  it("supersedes the previous assignment rather than deleting it", async () => {
    const { PATCH } = await import("./route");
    await PATCH(fakeRequest({ program_id: "tmpl-1" }), { params: { id: "client-1" } });
    const first = db.tables.program_assignments.find((a) => a.profile_id === "client-1")!.id;

    await PATCH(fakeRequest({ program_id: "meet-tmpl" }), { params: { id: "client-1" } });

    const all = db.tables.program_assignments.filter((a) => a.profile_id === "client-1");
    expect(all).toHaveLength(2);
    const superseded = all.find((a) => a.id === first)!;
    expect(superseded.status).toBe("superseded");
    expect(all.filter((a) => a.status === "active")).toHaveLength(1);
  });

  it("fails the request when sessions cannot be built, rather than reporting success", async () => {
    // No stub: the fake returns an error from the materialize call.
    db = new FakeSupabase({
      profiles: [{ id: "client-1", role: "client", is_active: true, tier: "free", timezone: "America/Toronto" }],
      programs: [{
        id: "tmpl-1", goal: "hybrid", name: "T", description: "d",
        structure: { weeks: [] }, is_template: true, is_default_template: false,
        client_id: null, meet_date: null, attempt_plan: null, weaknesses: null,
      }],
      program_assignments: [],
    });
    mockSupabaseForRequest.mockResolvedValue({ client: db, session: coachSession() });

    const { PATCH } = await import("./route");
    const res = await PATCH(fakeRequest({ program_id: "tmpl-1" }), { params: { id: "client-1" } });
    expect(res.status).toBe(500);
  });
});
