"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TIER_LABELS: Record<string, string> = {
  paid_programming: "Programming",
  paid_coaching: "Coaching",
};

/**
 * Confirms the outcome of a Stripe Checkout redirect. Success can arrive before
 * the webhook has actually landed (network timing, not app logic — the webhook
 * is what grants entitlement, this page just reports on it), so this polls via
 * router.refresh() for a bit rather than claiming the plan is active before it
 * really is.
 */
export function CheckoutStatusBanner({
  status,
  planActive,
  tier,
}: {
  status: "success" | "cancelled" | null;
  planActive: boolean;
  tier: string | null;
}) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const maxAttempts = 6; // ~30s of light polling
  const stillWaiting = status === "success" && !planActive;

  useEffect(() => {
    if (!stillWaiting || attempts >= maxAttempts) return;
    const t = setTimeout(() => {
      setAttempts((a) => a + 1);
      router.refresh();
    }, 5000);
    return () => clearTimeout(t);
  }, [stillWaiting, attempts, router]);

  if (dismissed || !status) return null;

  if (status === "cancelled") {
    return (
      <div className="w-full max-w-md bg-jcf-panel border border-white/10 rounded-sm p-4 mb-6 text-sm text-jcf-gray flex items-start justify-between gap-3">
        <span>Checkout was cancelled — you weren&apos;t charged. Pick a plan below whenever you&apos;re ready.</span>
        <button
          onClick={() => setDismissed(true)}
          className="text-jcf-gray hover:text-white text-xs uppercase tracking-widest shrink-0"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (planActive) {
    const label = tier ? (TIER_LABELS[tier] ?? tier) : "paid";
    return (
      <div className="w-full max-w-md bg-jcf-gold/10 border border-jcf-gold rounded-sm p-4 mb-6 text-sm text-white flex items-start justify-between gap-3">
        <span>Payment received — you&apos;re on the {label} plan. Welcome aboard.</span>
        <button
          onClick={() => setDismissed(true)}
          className="text-jcf-gray hover:text-white text-xs uppercase tracking-widest shrink-0"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-jcf-panel border border-white/10 rounded-sm p-4 mb-6 text-sm text-jcf-gray">
      <p>Payment received — activating your plan now. This usually takes just a few seconds.</p>
      {attempts >= maxAttempts && (
        <button
          onClick={() => {
            setAttempts(0);
            router.refresh();
          }}
          className="mt-2 text-jcf-gold hover:underline text-xs uppercase tracking-widest"
        >
          Still not showing — refresh
        </button>
      )}
    </div>
  );
}
