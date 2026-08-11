import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabase } from "@/test/fakeSupabase";

let nextEvent: any;
const constructEvent = vi.fn(() => nextEvent);

vi.mock("@/lib/stripe", async () => {
  const actual = await vi.importActual<typeof import("@/lib/stripe")>("@/lib/stripe");
  return {
    ...actual,
    getStripe: () => ({ webhooks: { constructEvent } }),
  };
});

let db: FakeSupabase;
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => db,
}));

const sendWelcomeEmailOnce = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email/sendWelcome", () => ({ sendWelcomeEmailOnce: (...args: any[]) => sendWelcomeEmailOnce(...args) }));

function fakeRequest() {
  return {
    headers: { get: (name: string) => (name === "stripe-signature" ? "sig" : null) },
    text: async () => "raw-body",
  } as any;
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, STRIPE_WEBHOOK_SECRET: "whsec_test", STRIPE_PRICE_ID_PROGRAMMING: "price_prog", STRIPE_PRICE_ID_COACHING: "price_coach" };
  db = new FakeSupabase({
    profiles: [{ id: "client-1", email: "a@b.com", full_name: "A", tier: "free", subscription_status: "n/a" }],
  });
  constructEvent.mockClear();
  sendWelcomeEmailOnce.mockClear();
});

describe("POST /api/stripe/webhook", () => {
  it("activates the paid tier and sends the welcome email on checkout.session.completed", async () => {
    nextEvent = {
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          metadata: { profile_id: "client-1", tier: "paid_programming" },
          client_reference_id: null,
          subscription: "sub_1",
          customer: "cus_1",
        },
      },
    };
    const { POST } = await import("./route");
    const res = await POST(fakeRequest());
    expect(res.status).toBe(200);

    const profile = db.tables.profiles.find((p) => p.id === "client-1")!;
    expect(profile.tier).toBe("paid_programming");
    expect(profile.subscription_status).toBe("active");
    expect(profile.stripe_customer_id).toBe("cus_1");
    expect(sendWelcomeEmailOnce).toHaveBeenCalledTimes(1);
  });

  it("does not reprocess a duplicate delivery of the same event id", async () => {
    nextEvent = {
      id: "evt_dup",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          metadata: { profile_id: "client-1", tier: "paid_programming" },
          subscription: "sub_1",
          customer: "cus_1",
        },
      },
    };
    const { POST } = await import("./route");

    await POST(fakeRequest());
    expect(sendWelcomeEmailOnce).toHaveBeenCalledTimes(1);

    // Mutate the profile back to prove the second delivery is a true no-op, not
    // just idempotent by coincidence.
    db.tables.profiles.find((p) => p.id === "client-1")!.tier = "free";

    const res2 = await POST(fakeRequest());
    const body2 = await res2.json();
    expect(body2.duplicate).toBe(true);
    expect(sendWelcomeEmailOnce).toHaveBeenCalledTimes(1); // not called again
    expect(db.tables.profiles.find((p) => p.id === "client-1")!.tier).toBe("free"); // not touched
  });

  it("re-syncs tier from the subscription's actual price on customer.subscription.updated", async () => {
    db.tables.profiles[0].stripe_subscription_id = "sub_1";
    db.tables.profiles[0].tier = "paid_programming";
    nextEvent = {
      id: "evt_2",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          status: "active",
          metadata: {},
          items: { data: [{ price: { id: "price_coach" } }] }, // upgraded to Coaching
        },
      },
    };
    const { POST } = await import("./route");
    await POST(fakeRequest());
    expect(db.tables.profiles[0].tier).toBe("paid_coaching");
    expect(db.tables.profiles[0].subscription_status).toBe("active");
  });

  it("cancels back to free tier on customer.subscription.deleted", async () => {
    db.tables.profiles[0].stripe_subscription_id = "sub_1";
    db.tables.profiles[0].tier = "paid_coaching";
    nextEvent = {
      id: "evt_3",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1", metadata: {} } },
    };
    const { POST } = await import("./route");
    await POST(fakeRequest());
    expect(db.tables.profiles[0].tier).toBe("free");
    expect(db.tables.profiles[0].subscription_status).toBe("canceled");
  });

  it("quietly ignores a subscription that was never created through the portal", async () => {
    // Same Stripe account, different product — the endpoint is subscribed
    // account-wide, so these events arrive here and must not raise an error the
    // coach has to triage on /coach/monitoring.
    nextEvent = {
      id: "evt_foreign",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_sold_elsewhere",
          status: "active",
          metadata: {},
          items: { data: [{ price: { id: "price_some_other_product" } }] },
        },
      },
    };
    const { POST } = await import("./route");
    const res = await POST(fakeRequest());
    expect(res.status).toBe(200);

    const logged = db.tables.event_log ?? [];
    expect(logged.map((e) => e.level)).toEqual(["info"]);
    // The unrecognized-price warning must not fire either — there's no tier to
    // resync on a subscription that isn't ours.
    expect(logged.some((e) => e.message.includes("unrecognized price"))).toBe(false);
  });

  it("still errors when metadata names a profile that does not exist", async () => {
    nextEvent = {
      id: "evt_orphan",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          status: "active",
          metadata: { profile_id: "client-deleted" },
          items: { data: [{ price: { id: "price_coach" } }] },
        },
      },
    };
    const { POST } = await import("./route");
    await POST(fakeRequest());

    const logged = db.tables.event_log ?? [];
    expect(logged).toHaveLength(1);
    expect(logged[0].level).toBe("error");
    expect(logged[0].profile_id).toBe("client-deleted");
  });

  it("warns about an unrecognized price only when the subscription is ours", async () => {
    db.tables.profiles[0].stripe_subscription_id = "sub_1";
    db.tables.profiles[0].tier = "paid_coaching";
    nextEvent = {
      id: "evt_badprice",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          status: "active",
          metadata: {},
          items: { data: [{ price: { id: "price_retired" } }] },
        },
      },
    };
    const { POST } = await import("./route");
    await POST(fakeRequest());

    const logged = db.tables.event_log ?? [];
    expect(logged).toHaveLength(1);
    expect(logged[0].level).toBe("warning");
    // Status still syncs; only the tier is left alone.
    expect(db.tables.profiles[0].subscription_status).toBe("active");
    expect(db.tables.profiles[0].tier).toBe("paid_coaching");
  });

  it("rejects when the signature is missing", async () => {
    const req = { headers: { get: () => null }, text: async () => "raw" } as any;
    const { POST } = await import("./route");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
