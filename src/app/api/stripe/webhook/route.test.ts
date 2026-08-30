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

  it("ignores a stale subscription.updated for a subscription the profile has moved off", async () => {
    // Stripe doesn't guarantee ordering: a delayed delivery for the replaced
    // subscription arrives after the profile is already on sub_2.
    db.tables.profiles[0].stripe_subscription_id = "sub_2";
    db.tables.profiles[0].tier = "paid_coaching";
    db.tables.profiles[0].subscription_status = "active";
    nextEvent = {
      id: "evt_stale_update",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          status: "canceled",
          metadata: { profile_id: "client-1" },
          items: { data: [{ price: { id: "price_prog" } }] },
        },
      },
    };
    const { POST } = await import("./route");
    await POST(fakeRequest());

    // None of the stale subscription's state may leak onto the live one.
    expect(db.tables.profiles[0].stripe_subscription_id).toBe("sub_2");
    expect(db.tables.profiles[0].subscription_status).toBe("active");
    expect(db.tables.profiles[0].tier).toBe("paid_coaching");
    expect((db.tables.event_log ?? []).map((e) => e.level)).toEqual(["warning"]);
  });

  it("accepts subscription.updated for a profile whose checkout has not landed yet", async () => {
    // No subscription recorded — this event is the first thing to describe it, so
    // the stale-event guard must not treat a null id as a mismatch.
    db.tables.profiles[0].stripe_subscription_id = null;
    nextEvent = {
      id: "evt_early_update",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          status: "active",
          metadata: { profile_id: "client-1" },
          items: { data: [{ price: { id: "price_coach" } }] },
        },
      },
    };
    const { POST } = await import("./route");
    await POST(fakeRequest());

    expect(db.tables.profiles[0].stripe_subscription_id).toBe("sub_1");
    expect(db.tables.profiles[0].tier).toBe("paid_coaching");
    expect(db.tables.profiles[0].subscription_status).toBe("active");
    expect(db.tables.event_log ?? []).toHaveLength(0);
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

  it("retries rather than silently dropping a paid checkout whose entitlement write fails", async () => {
    // FakeSupabase never fails, so force the profiles update to report the kind of
    // transient error the handler used to discard.
    const realFrom = db.from.bind(db);
    let failNextProfileWrite = true;
    vi.spyOn(db, "from").mockImplementation((table: string) => {
      const builder = realFrom(table);
      if (table === "profiles" && failNextProfileWrite) {
        failNextProfileWrite = false;
        (builder as any).maybeSingle = async () => ({ data: null, error: { message: "connection reset" } });
      }
      return builder;
    });

    nextEvent = {
      id: "evt_write_fail",
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

    const res1 = await POST(fakeRequest());
    expect(res1.status).toBe(500);
    expect(db.tables.stripe_events ?? []).toHaveLength(0);
    expect(sendWelcomeEmailOnce).not.toHaveBeenCalled();
    expect((db.tables.event_log ?? []).some((e) => e.level === "error")).toBe(true);

    // Stripe retries; the write succeeds this time and the client is provisioned.
    const res2 = await POST(fakeRequest());
    expect(res2.status).toBe(200);
    expect(db.tables.profiles[0].tier).toBe("paid_programming");
    expect(sendWelcomeEmailOnce).toHaveBeenCalledTimes(1);
  });

  it("records, without retrying, a checkout naming a profile that does not exist", async () => {
    nextEvent = {
      id: "evt_ghost",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          metadata: { profile_id: "client-deleted", tier: "paid_coaching" },
          subscription: "sub_1",
          customer: "cus_1",
        },
      },
    };
    const { POST } = await import("./route");
    const res = await POST(fakeRequest());

    // Permanent condition — a retry can't conjure the profile, so the claim stands.
    expect(res.status).toBe(200);
    expect(db.tables.stripe_events).toHaveLength(1);
    expect(sendWelcomeEmailOnce).not.toHaveBeenCalled();
    const logged = db.tables.event_log ?? [];
    expect(logged).toHaveLength(1);
    expect(logged[0].level).toBe("error");
    expect(logged[0].profile_id).toBe("client-deleted");
  });

  it("refuses to write an unrecognized tier from checkout metadata", async () => {
    nextEvent = {
      id: "evt_bad_tier",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          metadata: { profile_id: "client-1", tier: "paid_platinum" },
          subscription: "sub_1",
          customer: "cus_1",
        },
      },
    };
    const { POST } = await import("./route");
    await POST(fakeRequest());

    expect(db.tables.profiles[0].tier).toBe("free");
    expect(db.tables.profiles[0].subscription_status).toBe("n/a");
    expect(sendWelcomeEmailOnce).not.toHaveBeenCalled();
    const logged = db.tables.event_log ?? [];
    expect(logged).toHaveLength(1);
    expect(logged[0].level).toBe("error");
    expect(logged[0].message).toContain("unrecognized tier");
  });

  it("releases the idempotency claim when the handler fails, so Stripe's retry reprocesses", async () => {
    nextEvent = {
      id: "evt_fail",
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

    sendWelcomeEmailOnce.mockRejectedValueOnce(new Error("SMTP down"));
    const res1 = await POST(fakeRequest());
    expect(res1.status).toBe(500);
    // The claim must not survive the failure — otherwise the retry below would
    // short-circuit on 23505 and the event would never be processed at all.
    expect(db.tables.stripe_events ?? []).toHaveLength(0);

    const res2 = await POST(fakeRequest());
    expect(res2.status).toBe(200);
    expect((await res2.json()).duplicate).toBeUndefined();
    expect(sendWelcomeEmailOnce).toHaveBeenCalledTimes(2);
    expect(db.tables.profiles[0].tier).toBe("paid_programming");
  });

  it("does not downgrade a client whose old subscription is deleted after they resubscribed", async () => {
    // Cancelled at period end, then resubscribed before that date: the profile is
    // already on sub_2 when sub_1's deletion finally fires.
    db.tables.profiles[0].stripe_subscription_id = "sub_2";
    db.tables.profiles[0].tier = "paid_coaching";
    db.tables.profiles[0].subscription_status = "active";
    nextEvent = {
      id: "evt_stale_delete",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1", metadata: { profile_id: "client-1" } } },
    };
    const { POST } = await import("./route");
    await POST(fakeRequest());

    expect(db.tables.profiles[0].tier).toBe("paid_coaching");
    expect(db.tables.profiles[0].subscription_status).toBe("active");
    expect((db.tables.event_log ?? []).map((e) => e.level)).toEqual(["warning"]);
  });

  it("ignores a failed payment on an unrelated subscription for the same customer", async () => {
    // Same Stripe customer also holds a subscription sold outside the portal.
    db.tables.profiles[0].stripe_customer_id = "cus_1";
    db.tables.profiles[0].stripe_subscription_id = "sub_1";
    db.tables.profiles[0].subscription_status = "active";
    nextEvent = {
      id: "evt_foreign_invoice",
      type: "invoice.payment_failed",
      data: { object: { id: "in_1", customer: "cus_1", subscription: "sub_sold_elsewhere" } },
    };
    const { POST } = await import("./route");
    await POST(fakeRequest());

    expect(db.tables.profiles[0].subscription_status).toBe("active");
    expect((db.tables.event_log ?? []).map((e) => e.level)).toEqual(["info"]);
  });

  it("still marks past_due when the failed invoice is for the profile's own subscription", async () => {
    db.tables.profiles[0].stripe_customer_id = "cus_1";
    db.tables.profiles[0].stripe_subscription_id = "sub_1";
    db.tables.profiles[0].subscription_status = "active";
    nextEvent = {
      id: "evt_own_invoice",
      type: "invoice.payment_failed",
      data: { object: { id: "in_2", customer: "cus_1", subscription: "sub_1" } },
    };
    const { POST } = await import("./route");
    await POST(fakeRequest());

    expect(db.tables.profiles[0].subscription_status).toBe("past_due");
    expect(db.tables.event_log ?? []).toHaveLength(0);
  });

  it("rejects when the signature is missing", async () => {
    const req = { headers: { get: () => null }, text: async () => "raw" } as any;
    const { POST } = await import("./route");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
