import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const APPROVED_OFFERS = new Set([
  "JCF_LOCAL_12W_PIF",
  "JCF_LOCAL_12W_3PAY",
  "JCF_REMOTE_12W_PIF",
  "JCF_PRIVATE_60",
  "JCF_SHIFT_RESET_2026_11",
]);
const CHECKOUT_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);
const cryptoProvider = Stripe.createSubtleCryptoProvider();
type Env = (name: string) => string | undefined;
type Purchase = Record<string, string | number | null>;

export interface Store {
  processed(eventId: string): Promise<boolean>;
  receive(event: Stripe.Event): Promise<void>;
  purchase(row: Purchase): Promise<void>;
  complete(event: Stripe.Event): Promise<void>;
  fail(eventId: string): Promise<void>;
}

export function adminCredentials(env: Env): { url: string; key: string } {
  const url = env("SUPABASE_URL") ?? "";
  let key = env("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const secretKeys = env("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const candidate = JSON.parse(secretKeys).default;
      if (typeof candidate === "string" && candidate) key = candidate;
    } catch {
      // Preserve the deployed legacy service-role fallback.
    }
  }
  if (!url || !key) throw new Error("Admin configuration unavailable");
  return { url, key };
}

// Every database error must reach the handler so Stripe retries rather than
// receiving a false success. Never log raw errors, payloads, URLs, or secrets.
export function createStore(admin: SupabaseClient): Store {
  async function checked(result: PromiseLike<{ error: unknown }>) {
    if ((await result).error) throw new Error("Persistence failed");
  }
  return {
    async processed(eventId) {
      const { data, error } = await admin.from("jcf_stripe_events")
        .select("processed").eq("event_id", eventId).maybeSingle();
      if (error) throw new Error("Persistence failed");
      return data?.processed === true;
    },
    async receive(event) {
      // DO NOTHING on conflict: a concurrent delivery must not reset success.
      await checked(
        admin.from("jcf_stripe_events").upsert({
          event_id: event.id,
          event_type: event.type,
          processed: false,
          error_message: null,
        }, { onConflict: "event_id", ignoreDuplicates: true }),
      );
    },
    async purchase(row) {
      // Omit profile_id, engagement_id, activated_at, ops_alerted_at and
      // stripe_schedule_id: those belong to downstream/parallel workflows.
      await checked(
        admin.from("jcf_checkout_purchases")
          .upsert(row, { onConflict: "checkout_session_id" }),
      );
    },
    async complete(event) {
      await checked(
        admin.from("jcf_stripe_events").update({
          event_type: event.type,
          processed: true,
          error_message: null,
          processed_at: new Date().toISOString(),
        }).eq("event_id", event.id),
      );
    },
    async fail(eventId) {
      // A failing concurrent delivery cannot downgrade a completed event.
      await checked(
        admin.from("jcf_stripe_events").update({
          error_message: "Bridge processing failed; retry required.",
        }).eq("event_id", eventId).eq("processed", false),
      );
    },
  };
}

export function environmentStore(env: Env): Store {
  const { url, key } = adminCredentials(env);
  return createStore(createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}

function id(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

export function createHandler(
  env: Env,
  storeFactory: () => Store = () => environmentStore(env),
) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "POST" },
      });
    }
    const secret = env("JCF_STRIPE_BRIDGE_SIGNING_SECRET");
    if (!secret) return new Response("Webhook unavailable", { status: 503 });
    const signature = req.headers.get("stripe-signature");
    if (!signature) return new Response("Invalid signature", { status: 400 });

    let event: Stripe.Event;
    try {
      // SDK authenticates the untouched body before JSON parsing. No API key
      // or Stripe API call is needed. Never accept the legacy URL key as auth.
      event = await Stripe.webhooks.constructEventAsync(
        await req.text(),
        signature,
        secret,
        300,
        cryptoProvider,
      );
      if (
        !event || typeof event.id !== "string" || !event.id ||
        typeof event.type !== "string" || !event.type
      ) {
        throw new Error("Invalid event");
      }
    } catch {
      return new Response("Invalid signature or payload", { status: 400 });
    }

    let store: Store | undefined;
    try {
      // Construct the privileged client only after successful authentication.
      store = storeFactory();
      if (await store.processed(event.id)) {
        return Response.json({ received: true, duplicate: true });
      }
      await store.receive(event);
      let outcome: "ignored" | "awaiting_payment" | "recorded" = "ignored";
      if (CHECKOUT_EVENTS.has(event.type)) {
        const session = event.data?.object as Stripe.Checkout.Session;
        const offerCode = session?.metadata?.offer_code;
        if (offerCode && APPROVED_OFFERS.has(offerCode)) {
          // Apply the paid gate to both completed and delayed success events;
          // never default a missing payment_status to paid.
          outcome = "awaiting_payment";
          if (session.payment_status === "paid") {
            const email = String(
              session.customer_details?.email ??
                session.customer_email ?? "",
            ).trim().toLowerCase();
            if (!email || !session.id?.startsWith("cs_")) {
              throw new Error("Invalid approved checkout");
            }
            await store.purchase({
              checkout_session_id: session.id,
              stripe_event_id: event.id,
              offer_code: offerCode,
              payment_link_id: id(session.payment_link),
              stripe_customer_id: id(session.customer),
              payment_intent_id: id(session.payment_intent),
              stripe_subscription_id: id(session.subscription),
              customer_email: email,
              customer_name:
                String(session.customer_details?.name ?? "").trim() || null,
              amount_total: Number(session.amount_total ?? 0),
              currency: String(session.currency ?? "usd"),
              payment_status: "paid",
              purchased_at: session.created
                ? new Date(Number(session.created) * 1000).toISOString()
                : new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            outcome = "recorded";
          }
        }
      }
      await store.complete(event);
      return Response.json({ received: true, [outcome]: true });
    } catch {
      try {
        await store?.fail(event.id);
      } catch {
        // Still return 500 if even recording the failure is unavailable.
      }
      return Response.json({ error: "Processing failed." }, { status: 500 });
    }
  };
}
