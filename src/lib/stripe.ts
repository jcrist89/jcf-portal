import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY env var.");
  cached = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  return cached;
}

// A getter (not a module-load-time constant) so the env vars are read at call
// time — avoids depending on module import order, and makes this testable
// without needing env vars set before the module first evaluates.
export const TIER_PRICE_IDS: Record<"paid_programming" | "paid_coaching", string> = {
  get paid_programming() {
    return process.env.STRIPE_PRICE_ID_PROGRAMMING ?? "";
  },
  get paid_coaching() {
    return process.env.STRIPE_PRICE_ID_COACHING ?? "";
  },
};

/** Reverse lookup of TIER_PRICE_IDS — used to re-derive tier from a subscription's
 *  actual current price, e.g. when a plan change happens via the Stripe customer
 *  portal rather than through our own checkout flow. */
export function tierFromPriceId(priceId: string | undefined | null): "paid_programming" | "paid_coaching" | null {
  if (!priceId) return null;
  if (priceId === TIER_PRICE_IDS.paid_programming) return "paid_programming";
  if (priceId === TIER_PRICE_IDS.paid_coaching) return "paid_coaching";
  return null;
}
