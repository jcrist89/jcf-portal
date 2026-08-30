import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabase } from "@/test/fakeSupabase";

let db: FakeSupabase;
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => db }));
const sendPushToProfile = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/push", () => ({ sendPushToProfile: (...a: any[]) => sendPushToProfile(...a) }));

function fakeRequest(secret = "test-secret") {
  return { headers: { get: (name: string) => (name === "authorization" ? `Bearer ${secret}` : null) } } as any;
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, CRON_SECRET: "test-secret" };
  sendPushToProfile.mockClear();
});

describe("GET /api/cron/nudge", () => {
  it("rejects a request without the correct bearer secret", async () => {
    db = new FakeSupabase({ profiles: [] }).stubRpc("mark_missed_sessions", () => 0);
    const { GET } = await import("./route");
    const res = await GET(fakeRequest("wrong"));
    expect(res.status).toBe(401);
  });

  it("sends a nudge to a client quiet for 7+ days and records the threshold", async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    db = new FakeSupabase({
      profiles: [{ id: "c1", role: "client", is_active: true, created_at: eightDaysAgo, last_nudge_threshold: null }],
      workout_logs: [{ id: "w1", profile_id: "c1", date: eightDaysAgo, completed: true }],
      measurements: [],
      prs: [],
    }).stubRpc("mark_missed_sessions", () => 0);
    const { GET } = await import("./route");
    const res = await GET(fakeRequest());
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(sendPushToProfile).toHaveBeenCalledTimes(1);
    expect(db.tables.profiles[0].last_nudge_threshold).toBe(7);
  });

  it("isolates a per-client failure — one bad client doesn't abort the run or the response", async () => {
    db = new FakeSupabase({
      profiles: [
        { id: "c1", role: "client", is_active: true, created_at: "2020-01-01", last_nudge_threshold: null },
        { id: "c2", role: "client", is_active: true, created_at: "2020-01-01", last_nudge_threshold: null },
      ],
      workout_logs: [],
      measurements: [],
      prs: [],
      event_log: [],
    }).stubRpc("mark_missed_sessions", () => 0);
    // Force a failure only for c1 by making its push send throw.
    sendPushToProfile.mockImplementation(async (profileId: string) => {
      if (profileId === "c1") throw new Error("push provider down");
    });

    const { GET } = await import("./route");
    const res = await GET(fakeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checked).toBe(2);
    expect(body.failed).toBe(1);
    expect(db.tables.event_log.some((e) => e.source === "cron.nudge" && e.profile_id === "c1")).toBe(true);
    // c2 still got processed despite c1's failure.
    expect(sendPushToProfile).toHaveBeenCalledWith("c2", expect.anything());
  });

  it("flags a paid tier with a canceled subscription as a tier mismatch", async () => {
    db = new FakeSupabase({
      profiles: [
        {
          id: "c1",
          role: "client",
          is_active: true,
          created_at: new Date().toISOString(),
          last_nudge_threshold: null,
          tier: "paid_coaching",
          subscription_status: "canceled",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
        },
      ],
      workout_logs: [],
      measurements: [],
      prs: [],
      event_log: [],
    }).stubRpc("mark_missed_sessions", () => 0);
    const { GET } = await import("./route");
    const res = await GET(fakeRequest());
    const body = await res.json();
    expect(body.tierMismatches).toBe(1);
    expect(db.tables.event_log.some((e) => e.source === "cron.tier_mismatch")).toBe(true);
  });

  it("does not flag a comped tier (no stripe_customer_id) as a mismatch", async () => {
    db = new FakeSupabase({
      profiles: [
        {
          id: "c1",
          role: "client",
          is_active: true,
          created_at: new Date().toISOString(),
          last_nudge_threshold: null,
          tier: "paid_coaching",
          subscription_status: "n/a",
          stripe_customer_id: null,
        },
      ],
      workout_logs: [],
      measurements: [],
      prs: [],
      event_log: [],
    }).stubRpc("mark_missed_sessions", () => 0);
    const { GET } = await import("./route");
    const res = await GET(fakeRequest());
    const body = await res.json();
    expect(body.tierMismatches).toBe(0);
  });
});

describe("GET /api/cron/nudge — missed-session sweep", () => {
  it("reports how many sessions the sweep dropped", async () => {
    db = new FakeSupabase({ profiles: [] }).stubRpc("mark_missed_sessions", () => 7);
    const { GET } = await import("./route");
    const res = await GET(fakeRequest());
    expect(await res.json()).toMatchObject({ missedSessions: 7 });
  });

  it("does not fail the whole run when the sweep errors", async () => {
    // No stub registered, so the fake returns an error — the nudge run must still report.
    db = new FakeSupabase({ profiles: [] });
    const { GET } = await import("./route");
    const res = await GET(fakeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ missedSessions: 0 });
  });
});
