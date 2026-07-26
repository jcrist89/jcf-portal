import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY env var.");
  cached = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  return cached;
}

export const TIER_PRICE_IDS: Record<"paid_programming" | "paid_coaching", string> = {
  paid_programming: process.env.STRIPE_PRICE_ID_PROGRAMMING ?? "",
  paid_coaching: process.env.STRIPE_PRICE_ID_COACHING ?? "",
};
