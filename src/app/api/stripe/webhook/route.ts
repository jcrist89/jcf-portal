import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
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

/** The only tiers a completed subscription checkout can legitimately grant.
 *  "free" is a valid Tier but never the result of paying for something. */
const PAID_TIERS: Tier[] = ["paid_programming", "paid_coaching"];

function isPaidTier(value: string): value is Tier {
  return (PAID_TIERS as string[]).includes(value);
}

/** The subscription an invoice was raised for (expanded or not), or null for a
 *  one-off invoice with no subscription behind it. */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  if (!invoice.subscription) return null;
  return typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id;
}

const LOCAL_3PAY_OFFER = "JCF_LOCAL_12W_3PAY";

async function ensureLocalThreePaymentSchedule(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    throw new Error("Local 3-pay checkout completed without a subscription.");
  }

  const { data: offer, error: offerError } = await admin
    .from("offers")
    .select("stripe_price_id")
    .eq("code", LOCAL_3PAY_OFFER)
    .maybeSingle();

  if (offerError || !offer?.stripe_price_id) {
    throw new Error(`Local 3-pay Stripe price is not configured: ${offerError?.message ?? "missing price"}`);
  }

  const stripe = getStripe();
  let subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data[0];

  if (!item || item.price.id !== offer.stripe_price_id) {
    throw new Error("Local 3-pay checkout subscription does not match the approved installment price.");
  }

  // Give all future subscription events an explicit commercial identity. This
  // keeps them out of the retired tier/price sync path below.
  if (subscription.metadata?.offer_code !== LOCAL_3PAY_OFFER) {
    subscription = await stripe.subscriptions.update(subscription.id, {
      metadata: {
        ...subscription.metadata,
        offer_code: LOCAL_3PAY_OFFER,
        installment_count: "3",
        fixed_term: "true",
      },
    });
  }

  let scheduleId =
    typeof subscription.schedule === "string"
      ? subscription.schedule
      : subscription.schedule?.id ?? null;

  if (!scheduleId) {
    const created = await stripe.subscriptionSchedules.create({
      from_subscription: subscription.id,
    });
    scheduleId = created.id;
  }

  const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  const current = schedule.phases.find(
    (phase) =>
      phase.start_date <= Math.floor(Date.now() / 1000) &&
      phase.end_date > Math.floor(Date.now() / 1000),
  ) ?? schedule.phases[0];

  if (!current) {
    throw new Error("Stripe created a subscription schedule without a current phase.");
  }

  const phaseItems = current.items.map((phaseItem) => ({
    price:
      typeof phaseItem.price === "string"
        ? phaseItem.price
        : phaseItem.price.id,
    quantity: phaseItem.quantity ?? 1,
  }));

  // Checkout already collected payment #1 for the current monthly period.
  // Keep that current phase intact, then run the same price for two additional
  // monthly periods. end_behavior=cancel stops the subscription before a fourth
  // charge can be generated.
  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "cancel",
    metadata: {
      ...schedule.metadata,
      offer_code: LOCAL_3PAY_OFFER,
      installment_count: "3",
      fixed_term: "true",
    },
    phases: [
      {
        start_date: current.start_date,
        end_date: current.end_date,
        items: phaseItems,
        proration_behavior: "none",
      },
      {
        start_date: current.end_date,
        iterations: 2,
        items: phaseItems,
        proration_behavior: "none",
        metadata: {
          offer_code: LOCAL_3PAY_OFFER,
          installment_count: "3",
          fixed_term: "true",
        },
      },
    ],
  });

  // The Supabase checkout bridge may have recorded the purchase before or after
  // this webhook. Update if the row already exists; the bridge independently
  // persists subscriptionId so ordering between the two endpoints is harmless.
  await admin
    .from("jcf_checkout_purchases")
    .update({
      stripe_subscription_id: subscription.id,
      stripe_schedule_id: schedule.id,
      updated_at: new Date().toISOString(),
    })
    .eq("checkout_session_id", session.id);
}

async function processEvent(admin: SupabaseClient, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const offerCode = session.metadata?.offer_code;

      if (offerCode === LOCAL_3PAY_OFFER) {
        await ensureLocalThreePaymentSchedule(admin, session);
        await logEvent(admin, {
          level: "info",
          source: "stripe.installments",
          message: "Local 3-pay subscription fixed to exactly three monthly charges",
          context: { sessionId: session.id },
        });
        break;
      }

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
        break;
      }

      // Stripe metadata is a free-form string bag — our own checkout validates the
      // tier before setting it, but anything with dashboard access can write it
      // too, and the value lands directly in profiles.tier. An unrecognized string
      // is either rejected by the column or leaves the client in a tier requireTier
      // never matches, locking them out of everything they just paid for.
      if (!isPaidTier(tier)) {
        await logEvent(admin, {
          level: "error",
          source: "stripe.webhook",
          message: "checkout.session.completed carries an unrecognized tier — not applied",
          context: { sessionId: session.id, tier },
          profileId,
        });
        break;
      }

      const { data: profile, error: updateError } = await admin
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

      // The client has already paid by this point, so a failed entitlement write is
      // the worst outcome this handler has. Throw rather than log-and-continue:
      // that releases the idempotency claim in POST and lets Stripe retry, which is
      // the only route back to a provisioned account.
      if (updateError) {
        throw new Error(
          `checkout.session.completed could not grant ${tier} to profile ${profileId}: ${updateError.message}`,
        );
      }

      // No error but no row means the id simply isn't there. Retrying can't conjure
      // a profile, so record it for the coach to chase instead of burning Stripe's
      // retry budget on a permanent condition.
      if (!profile) {
        await logEvent(admin, {
          level: "error",
          source: "stripe.webhook",
          message: "checkout.session.completed names a profile_id that does not exist",
          context: { sessionId: session.id, subscriptionId: String(session.subscription) },
          profileId,
        });
        break;
      }

      await sendWelcomeEmailOnce(admin, {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        tier,
      });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const profileId = sub.metadata?.profile_id;
      const offerCode = sub.metadata?.offer_code;
      const status = statusFromSubscription(sub);

      if (offerCode === LOCAL_3PAY_OFFER) {
        const { data: matched, error: matchError } = await admin
          .from("profiles")
          .update({
            subscription_status: status,
            stripe_subscription_id: sub.id,
          })
          .eq("stripe_subscription_id", sub.id)
          .select("id");

        if (matchError) {
          await logEvent(admin, {
            level: "error",
            source: "stripe.installments",
            message: "Local 3-pay subscription update could not sync profile billing status",
            context: { subscriptionId: sub.id, error: matchError.message },
          });
        } else if (!matched || matched.length === 0) {
          await logEvent(admin, {
            level: "info",
            source: "stripe.installments",
            message: "Local 3-pay subscription update arrived before onboarding linked the profile",
            context: { subscriptionId: sub.id },
          });
        }
        break;
      }
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
      // land here too. Resolve the target first rather than writing blind: with
      // metadata present the old code wrote by profile id alone, which says nothing
      // about whether this event still describes that profile's current plan.
      const { data: target, error: lookupError } = profileId
        ? await admin.from("profiles").select("id, stripe_subscription_id").eq("id", profileId).maybeSingle()
        : await admin.from("profiles").select("id, stripe_subscription_id").eq("stripe_subscription_id", sub.id).maybeSingle();

      if (lookupError) {
        await logEvent(admin, {
          level: "error",
          source: "stripe.webhook",
          message: "subscription.updated could not resolve the target profile",
          context: { subscriptionId: sub.id, error: lookupError.message },
          profileId: profileId ?? null,
        });
        break;
      }

      if (!target) {
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

      // Stripe doesn't guarantee event ordering, and a delayed or retried delivery
      // for a subscription the profile has already moved off would otherwise pull
      // stripe_subscription_id back to the dead one and apply its stale status and
      // price — downgrading someone who is paying, and pointing the profile at a
      // subscription whose future events no longer match anything. A null id is
      // still fair game: that's a profile whose checkout hasn't landed yet, and
      // this event is the first thing to describe the subscription.
      if (target.stripe_subscription_id && target.stripe_subscription_id !== sub.id) {
        await logEvent(admin, {
          level: "warning",
          source: "stripe.webhook",
          message: "subscription.updated ignored — profile has since moved to a different subscription",
          context: { subscriptionId: sub.id, currentSubscriptionId: target.stripe_subscription_id },
          profileId: target.id,
        });
        break;
      }

      const { error: matchError } = await admin.from("profiles").update(updates).eq("id", target.id);

      if (matchError) {
        await logEvent(admin, {
          level: "error",
          source: "stripe.webhook",
          message: "subscription.updated failed to write the matched profile",
          context: { subscriptionId: sub.id, error: matchError.message },
          profileId: target.id,
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
          profileId: target.id,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const profileId = sub.metadata?.profile_id;
      const offerCode = sub.metadata?.offer_code;

      if (offerCode === LOCAL_3PAY_OFFER) {
        const { error: fixedTermError } = await admin
          .from("profiles")
          .update({ subscription_status: "canceled" })
          .eq("stripe_subscription_id", sub.id);

        if (fixedTermError) {
          await logEvent(admin, {
            level: "error",
            source: "stripe.installments",
            message: "Completed Local 3-pay subscription could not update billing status",
            context: { subscriptionId: sub.id, error: fixedTermError.message },
          });
        }
        // Do not downgrade the coaching tier here. The 12-week engagement owns
        // service access and may still be inside its final days when billing ends.
        break;
      }

      // Scope the downgrade to this exact subscription even when metadata names the
      // profile. Matching on profile_id alone downgrades whatever subscription the
      // profile currently holds, which isn't necessarily the one being deleted: a
      // client who cancels at period end and resubscribes before that date already
      // has a newer subscription on their profile by the time this event fires for
      // the old one, and would be dropped to free while paying.
      let query = admin
        .from("profiles")
        .update({ subscription_status: "canceled", tier: "free" })
        .eq("stripe_subscription_id", sub.id);
      if (profileId) query = query.eq("id", profileId);
      const { data: matched, error: matchError } = await query.select("id");

      if (matchError) {
        await logEvent(admin, {
          level: "error",
          source: "stripe.webhook",
          message: "subscription.deleted failed to write the matched profile",
          context: { subscriptionId: sub.id, error: matchError.message },
          profileId: profileId ?? null,
        });
        break;
      }

      if (!matched || matched.length === 0) {
        // With metadata, a miss means the profile has since moved to a different
        // subscription — worth surfacing, but as a warning: ignoring the event is
        // the correct outcome here, not a failure. Without metadata it's just an
        // account-wide event for a subscription that was never ours.
        await logEvent(admin, {
          level: profileId ? "warning" : "info",
          source: "stripe.webhook",
          message: profileId
            ? "subscription.deleted ignored — profile has since moved to a different subscription"
            : "subscription.deleted ignored — not a portal subscription",
          context: { subscriptionId: sub.id },
          profileId: profileId ?? null,
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      // Key on the subscription, not the customer. This endpoint is subscribed
      // account-wide and the same Stripe account carries subscriptions sold outside
      // the portal, so matching on stripe_customer_id alone let a failed payment on
      // an unrelated subscription — or on a one-off invoice — mark a portal client
      // past_due while they were fully paid up on their portal plan.
      const subscriptionId = subscriptionIdFromInvoice(invoice);
      if (!subscriptionId) {
        await logEvent(admin, {
          level: "info",
          source: "stripe.webhook",
          message: "invoice.payment_failed ignored — invoice has no subscription",
          context: { invoiceId: invoice.id },
        });
        break;
      }

      const { data: matched, error: matchError } = await admin
        .from("profiles")
        .update({ subscription_status: "past_due" })
        .eq("stripe_subscription_id", subscriptionId)
        .select("id");

      if (matchError) {
        await logEvent(admin, {
          level: "error",
          source: "stripe.webhook",
          message: "invoice.payment_failed failed to write the matched profile",
          context: { invoiceId: invoice.id, subscriptionId, error: matchError.message },
        });
        break;
      }

      if (!matched || matched.length === 0) {
        await logEvent(admin, {
          level: "info",
          source: "stripe.webhook",
          message: "invoice.payment_failed ignored — not a portal subscription",
          context: { invoiceId: invoice.id, subscriptionId },
        });
      }
      break;
    }

    default:
      break;
  }
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
  // than once. Claim the event id before processing; if it's already there, this
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

  try {
    await processEvent(admin, event);
  } catch (err) {
    // That row is written before the work, so it's a claim on the event, not a
    // record that the work finished. Leaving it behind after a failure would make
    // Stripe's retry hit the 23505 branch and skip the event permanently — a
    // client could pay and never be provisioned, with no further deliveries left
    // to recover from. Release the claim so the retry actually reprocesses.
    // Released before logging, so a logging failure can't strand the claim.
    await admin.from("stripe_events").delete().eq("id", event.id);
    await logEvent(admin, {
      level: "error",
      source: "stripe.webhook",
      message: "Handler failed — released the idempotency claim for Stripe to retry",
      context: { eventId: event.id, eventType: event.type, error: (err as Error)?.message },
    });
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
