import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, tierFromPriceId } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendWelcomeEmailOnce } from "@/lib/email/sendWelcome";
import { logEvent } from "@/lib/eventLog";
import type { Tier } from "@/lib/types";

export const runtime = "nodejs";

function statusFromSubscription(sub: Stripe.Subscription): "active" | "past_due" | "canceled" {
  if (sub.status === "active" || sub.status === "trialing") return "active";
  if (sub.status === "past_due" || sub.status === "unpaid") return "past_due";
  return "canceled";
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${(err as Error).message}` }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Idempotency: Stripe delivers at-least-once, so the same event can arrive more
  // than once. Record the event id before processing; if it's already there, this
  // is a retried delivery — skip re-processing (still return 200 so Stripe doesn't
  // keep retrying).
  const { error: dedupeError } = await admin
    .from("stripe_events")
    .insert({ id: event.id, event_type: event.type });
  if (dedupeError) {
    // Unique violation (23505) means we've already processed this event id.
    if (dedupeError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    await logEvent(admin, {
      level: "error",
      source: "stripe.webhook",
      message: "Failed to record event for idempotency",
      context: { eventId: event.id, eventType: event.type, error: dedupeError.message },
    });
    // Don't process without a recorded dedupe row — fail closed and let Stripe retry.
    return NextResponse.json({ error: "Could not record event." }, { status: 500 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const profileId = session.metadata?.profile_id ?? session.client_reference_id;
      const tier = session.metadata?.tier;
      if (!profileId || !tier || !session.subscription) {
        await logEvent(admin, {
          level: "error",
          source: "stripe.webhook",
          message: "checkout.session.completed missing expected metadata",
          context: { sessionId: session.id, hasProfileId: !!profileId, hasTier: !!tier, hasSubscription: !!session.subscription },
          profileId: typeof profileId === "string" ? profileId : null,
        });
      }
      if (profileId && tier && session.subscription) {
        const { data: profile } = await admin
          .from("profiles")
          .update({
            tier,
            subscription_status: "active",
            stripe_customer_id: String(session.customer),
            stripe_subscription_id: String(session.subscription),
          })
          .eq("id", profileId)
          .select("id, email, full_name")
          .maybeSingle();

        if (profile) {
          await sendWelcomeEmailOnce(admin, {
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            tier: tier as Tier,
          });
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const profileId = sub.metadata?.profile_id;
      const status = statusFromSubscription(sub);
      // Re-derive tier from the subscription's actual current price, not just
      // subscription_status — a plan change made via the Stripe customer portal
      // (billing/portal route allows switching plans) fires this event but was
      // previously only reflected in subscription_status, leaving profiles.tier
      // stale and the client's app-level entitlements out of sync with what
      // they're actually paying for.
      const priceId = sub.items.data[0]?.price?.id;
      const resyncedTier = tierFromPriceId(priceId);

      const updates: Record<string, unknown> = { subscription_status: status, stripe_subscription_id: sub.id };
      if (resyncedTier) updates.tier = resyncedTier;

      // Whether this subscription is ours at all is decided by whether it matches
      // a profile. This endpoint is subscribed account-wide, and the same Stripe
      // account also carries subscriptions sold outside the portal — their events
      // land here too. Do the write first, then let the match count decide how
      // loudly (if at all) to report what happened.
      const { data: matched, error: matchError } = profileId
        ? await admin.from("profiles").update(updates).eq("id", profileId).select("id")
        : await admin.from("profiles").update(updates).eq("stripe_subscription_id", sub.id).select("id");

      if (matchError) {
        await logEvent(admin, {
          level: "error",
          source: "stripe.webhook",
          message: "subscription.updated failed to write the matched profile",
          context: { subscriptionId: sub.id, error: matchError.message },
          profileId: profileId ?? null,
        });
        break;
      }

      if (!matched || matched.length === 0) {
        // Metadata naming a profile that no longer exists is a real problem —
        // that subscription came through our own checkout. Nothing matching with
        // no metadata at all just means the subscription was never created here,
        // which is expected and not worth putting in front of the coach.
        await logEvent(admin, {
          level: profileId ? "error" : "info",
          source: "stripe.webhook",
          message: profileId
            ? "subscription.updated names a profile_id that no longer exists"
            : "subscription.updated ignored — not a portal subscription",
          context: { subscriptionId: sub.id },
          profileId: profileId ?? null,
        });
        break;
      }

      // Only meaningful once the subscription is known to be ours: an unrecognized
      // price on a portal subscription means profiles.tier is now out of sync with
      // what the client is actually paying for.
      if (!resyncedTier) {
        await logEvent(admin, {
          level: "warning",
          source: "stripe.webhook",
          message: "subscription.updated with unrecognized price — tier not resynced",
          context: { subscriptionId: sub.id, priceId: priceId ?? null },
          profileId: profileId ?? null,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const profileId = sub.metadata?.profile_id;
      const query = admin.from("profiles").update({ subscription_status: "canceled", tier: "free" });
      if (profileId) await query.eq("id", profileId);
      else await query.eq("stripe_subscription_id", sub.id);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer ? String(invoice.customer) : null;
      if (customerId) {
        await admin
          .from("profiles")
          .update({ subscription_status: "past_due" })
          .eq("stripe_customer_id", customerId);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
