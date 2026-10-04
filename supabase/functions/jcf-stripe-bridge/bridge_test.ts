import { createClient } from "@supabase/supabase-js";
import { adminCredentials, createHandler, createStore } from "./bridge.ts";

// Synthetic only. Tests have no environment, filesystem, or network permissions.
const secret = "whsec_synthetic_test_fixture_not_a_real_credential";
type Row = Record<string, unknown>;
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
function equal(actual: unknown, expected: unknown) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}
function checkout(
  type = "checkout.session.completed",
  changes: Row = {},
  eventId = "evt_test",
) {
  return {
    id: eventId,
    object: "event",
    type,
    livemode: false,
    data: {
      object: {
        id: "cs_test_synthetic",
        object: "checkout.session",
        metadata: { offer_code: "JCF_LOCAL_12W_PIF" },
        payment_status: "paid",
        customer_details: { email: " TEST@example.invalid ", name: " Test " },
        amount_total: 120000,
        currency: "usd",
        created: 1791070000,
        customer: "cus_synthetic",
        payment_intent: "pi_synthetic",
        subscription: null,
        payment_link: "plink_synthetic",
        ...changes,
      },
    },
  };
}
async function signed(
  body: string,
  timestamp = Math.floor(Date.now() / 1000),
  signingSecret = secret,
) {
  // Independent HMAC fixture generator exercises the real Stripe SDK verifier.
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${body}`),
  );
  const hex = Array.from(
    new Uint8Array(mac),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  return `t=${timestamp},v1=${hex}`;
}
async function request(event: unknown = checkout(), options: {
  body?: string;
  signature?: string | null;
  url?: string;
  timestamp?: number;
} = {}) {
  const body = options.body ?? JSON.stringify(event);
  const signature = options.signature === undefined
    ? await signed(body, options.timestamp)
    : options.signature;
  return new Request(options.url ?? "https://bridge.invalid/", {
    method: "POST",
    body,
    headers: signature === null ? {} : { "stripe-signature": signature },
  });
}

// PostgREST boundary simulator: exercises the actual Supabase client and store,
// including conflict resolution, HTTP error propagation, and conditional updates.
class Database {
  events = new Map<string, Row>();
  purchases = new Map<string, Row>();
  calls: { method: string; table: string; body: Row | null }[] = [];
  failure: string | null = null;
  afterCommitFailure = false;
  fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    // Model an asynchronous transport boundary, including concurrent requests.
    await Promise.resolve();
    const url = new URL(String(input));
    const table = url.pathname.split("/").pop()!;
    assert(["jcf_stripe_events", "jcf_checkout_purchases"].includes(table));
    const method = init?.method ?? "GET";
    const body: Row | null = init?.body ? JSON.parse(String(init.body)) : null;
    this.calls.push({ method, table, body });
    const operation = method === "GET"
      ? "lookup"
      : table === "jcf_checkout_purchases"
      ? "purchase"
      : method === "POST"
      ? "receive"
      : body?.processed === true
      ? "complete"
      : "fail";
    const error = () =>
      Response.json(
        { message: "Synthetic persistence failure", code: "XX000" },
        { status: 500 },
      );
    if (this.failure === operation && !this.afterCommitFailure) return error();
    const rows = table === "jcf_stripe_events" ? this.events : this.purchases;
    const key = table === "jcf_stripe_events"
      ? "event_id"
      : "checkout_session_id";
    if (method === "GET") {
      const row = rows.get(url.searchParams.get(key)!.slice(3));
      return Response.json(row ? [row] : []);
    }
    if (method === "POST") {
      equal(url.searchParams.get("on_conflict"), key);
      const rowId = String(body![key]);
      const ignore = new Headers(init?.headers).get("prefer")?.includes(
        "resolution=ignore-duplicates",
      );
      if (!ignore || !rows.has(rowId)) {
        rows.set(rowId, { ...rows.get(rowId), ...body });
      }
    } else if (method === "PATCH") {
      const rowId = url.searchParams.get(key)!.slice(3);
      const row = rows.get(rowId);
      if (
        row &&
        (url.searchParams.get("processed") !== "eq.false" ||
          row.processed === false)
      ) {
        rows.set(rowId, { ...row, ...body });
      }
    }
    if (this.failure === operation) return error();
    return new Response(null, { status: 204 });
  };
}
function setup(configuredSecret: string | undefined = secret) {
  const db = new Database();
  let factoryCalls = 0;
  const store = createStore(
    createClient("https://database.invalid", "synthetic-admin-key", {
      global: { fetch: db.fetch },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  );
  const handler = createHandler(() => configuredSecret, () => {
    factoryCalls++;
    return store;
  });
  return { db, store, handler, factoryCalls: () => factoryCalls };
}

for (
  const type of [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
  ]
) {
  Deno.test(`valid signature records paid ${type}`, async () => {
    const { db, handler } = setup();
    const result = await handler(await request(checkout(type)));
    equal(result.status, 200);
    equal(await result.json(), { received: true, recorded: true });
    const purchase = db.purchases.get("cs_test_synthetic")!;
    equal(purchase.customer_email, "test@example.invalid");
    equal(purchase.customer_name, "Test");
    equal(purchase.payment_status, "paid");
    equal(purchase.amount_total, 120000);
    equal(db.events.get("evt_test")?.processed, true);
    equal(db.events.get("evt_test")?.event_type, type);
  });
  for (const status of ["unpaid", "no_payment_required", null]) {
    Deno.test(`${type} with ${status} cannot create paid evidence`, async () => {
      const { db, handler } = setup();
      equal(
        (await handler(
          await request(checkout(type, { payment_status: status })),
        )).status,
        200,
      );
      equal(db.purchases.size, 0);
      equal(db.events.get("evt_test")?.processed, true);
    });
  }
}

for (const signature of [null, "invalid", "t=0,v1=00"]) {
  Deno.test(`reject missing/invalid signature (${signature}) before any database access`, async () => {
    const { db, handler, factoryCalls } = setup();
    equal(
      (await handler(
        await request(checkout(), {
          signature,
          url: "https://bridge.invalid/?key=synthetic-legacy-key",
        }),
      )).status,
      400,
    );
    equal(factoryCalls(), 0);
    equal(db.calls.length, 0);
  });
}
Deno.test("wrong signing secret, changed raw bytes, and expired signature fail closed", async () => {
  const { handler, factoryCalls } = setup();
  const body = JSON.stringify(checkout());
  for (
    const req of [
      await request(checkout(), {
        signature: await signed(body, undefined, "wrong-secret"),
      }),
      await request(checkout(), {
        body: body + " ",
        signature: await signed(body),
      }),
      await request(checkout(), {
        timestamp: Math.floor(Date.now() / 1000) - 301,
      }),
    ]
  ) equal((await handler(req)).status, 400);
  equal(factoryCalls(), 0);
});
Deno.test("signed raw whitespace accepted; multiple v1 signatures supported", async () => {
  const { handler } = setup();
  const body = JSON.stringify(checkout(), null, 2) + "\n";
  equal(
    (await handler(
      await request(null, {
        body,
        signature: `${await signed(body)},v1=invalid`,
      }),
    )).status,
    200,
  );
});
Deno.test("signed malformed JSON and invalid event envelope rejected before persistence", async () => {
  const { handler, factoryCalls } = setup();
  for (
    const body of [
      "{broken",
      "null",
      "{}",
      '{"id":5,"type":"checkout.session.completed"}',
    ]
  ) {
    equal((await handler(await request(null, { body }))).status, 400);
  }
  equal(factoryCalls(), 0);
});
Deno.test("missing signing secret fails closed; non-POST returns 405", async () => {
  const { handler, factoryCalls } = setup("");
  equal((await handler(await request())).status, 503);
  equal((await handler(new Request("https://bridge.invalid/"))).status, 405);
  equal(factoryCalls(), 0);
});
Deno.test("unapproved offers and unrelated events are acknowledged without purchase", async () => {
  for (
    const event of [
      checkout(undefined, { metadata: { offer_code: "LEGACY" } }),
      checkout(undefined, { metadata: null }),
      checkout("invoice.paid"),
    ]
  ) {
    const { db, handler } = setup();
    equal((await handler(await request(event))).status, 200);
    equal(db.purchases.size, 0);
    equal(db.events.get("evt_test")?.processed, true);
  }
});
Deno.test("duplicate event skips writes; two events for same session retain activation fields", async () => {
  const { db, handler } = setup();
  await handler(await request());
  const writes = db.calls.filter((c) => c.method !== "GET").length;
  const duplicate = await handler(await request());
  equal(await duplicate.json(), { received: true, duplicate: true });
  equal(db.calls.filter((c) => c.method !== "GET").length, writes);
  Object.assign(db.purchases.get("cs_test_synthetic")!, {
    activated_at: "synthetic-date",
    profile_id: "synthetic-profile",
    engagement_id: "synthetic-engagement",
    stripe_schedule_id: "synthetic-schedule",
    ops_alerted_at: "synthetic-alert",
  });
  equal(
    (await handler(
      await request(
        checkout("checkout.session.async_payment_succeeded", {}, "evt_second"),
      ),
    )).status,
    200,
  );
  equal(db.purchases.size, 1);
  equal(db.purchases.get("cs_test_synthetic")?.activated_at, "synthetic-date");
  equal(
    db.purchases.get("cs_test_synthetic")?.stripe_schedule_id,
    "synthetic-schedule",
  );
  for (
    const call of db.calls.filter((c) => c.table === "jcf_checkout_purchases")
  ) {
    for (
      const field of [
        "activated_at",
        "profile_id",
        "engagement_id",
        "stripe_schedule_id",
        "ops_alerted_at",
      ]
    ) {
      assert(!(field in call.body!));
    }
  }
});
Deno.test("unpaid completed then paid delayed event records exactly one purchase", async () => {
  const { db, handler } = setup();
  await handler(
    await request(checkout(undefined, { payment_status: "unpaid" })),
  );
  equal(db.purchases.size, 0);
  await handler(
    await request(
      checkout("checkout.session.async_payment_succeeded", {}, "evt_paid"),
    ),
  );
  equal(db.purchases.size, 1);
});
for (const operation of ["lookup", "receive", "purchase", "complete"]) {
  Deno.test(`${operation} failure returns 500 and retry recovers`, async () => {
    const { db, handler } = setup();
    db.failure = operation;
    equal((await handler(await request())).status, 500);
    assert(db.events.get("evt_test")?.processed !== true);
    if (operation !== "complete") equal(db.purchases.size, 0);
    db.failure = null;
    equal((await handler(await request())).status, 200);
    equal(db.events.get("evt_test")?.processed, true);
    equal(db.purchases.size, 1);
  });
}
Deno.test("lost completion response cannot downgrade committed success", async () => {
  const { db, handler } = setup();
  db.failure = "complete";
  db.afterCommitFailure = true;
  equal((await handler(await request())).status, 500);
  equal(db.events.get("evt_test")?.processed, true);
  equal(db.events.get("evt_test")?.error_message, null);
  equal(await (await handler(await request())).json(), {
    received: true,
    duplicate: true,
  });
});
Deno.test("concurrent duplicate deliveries converge and late failure cannot reset success", async () => {
  const { db, store, handler } = setup();
  const requests = await Promise.all([request(), request()]);
  const results = await Promise.all(requests.map(handler));
  assert(results.every((r) => r.status === 200));
  equal(db.purchases.size, 1);
  await store.fail("evt_test");
  equal(db.events.get("evt_test")?.processed, true);
  equal(db.events.get("evt_test")?.error_message, null);
});
Deno.test("invalid paid checkout plus failure-bookkeeping error stays retryable", async () => {
  const { db, handler } = setup();
  db.failure = "fail";
  for (const changes of [{ customer_details: null }, { id: null }]) {
    equal(
      (await handler(await request(checkout(undefined, changes)))).status,
      500,
    );
    equal(db.purchases.size, 0);
    equal(db.events.get("evt_test")?.processed, false);
  }
});
Deno.test("admin initialization failure returns 500 after verification", async () => {
  const handler = createHandler(() => secret, () => {
    throw new Error("synthetic-private-error");
  });
  const response = await handler(await request());
  equal(response.status, 500);
  assert(!(await response.text()).includes("synthetic-private-error"));
});
Deno.test("environment admin credentials preserve secret-map and service-role fallback", () => {
  const env: Record<string, string> = {
    SUPABASE_URL: "https://database.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "legacy-fixture",
  };
  const read = (name: string) => env[name];
  equal(adminCredentials(read).key, "legacy-fixture");
  env.SUPABASE_SECRET_KEYS = '{"default":"new-fixture"}';
  equal(adminCredentials(read).key, "new-fixture");
  env.SUPABASE_SECRET_KEYS = "broken-json";
  equal(adminCredentials(read).key, "legacy-fixture");
  delete env.SUPABASE_SERVICE_ROLE_KEY;
  let threw = false;
  try {
    adminCredentials(read);
  } catch {
    threw = true;
  }
  assert(threw);
});
