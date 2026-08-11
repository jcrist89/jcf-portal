import { requireUser } from "@/lib/auth/require";
import Link from "next/link";
import { ClientNav } from "@/components/ClientNav";
import { BillingPanel } from "@/components/BillingPanel";

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  paid_programming: "Programming — $10/week",
  paid_coaching: "Coaching — $50/week",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  past_due: "Past Due",
  canceled: "Canceled",
  "n/a": "—",
};

export default async function BillingPage() {
  const { profile } = await requireUser("client");

  return (
    <div className="pb-24">
      <ClientNav />
      <main className="px-4 pt-6 max-w-md mx-auto">
        <h1 className="font-display text-2xl uppercase tracking-wide mb-6">Billing</h1>

        <div className="bg-jcf-panel border border-white/10 rounded-sm p-4 mb-4">
          <div className="text-jcf-gray text-xs uppercase tracking-widest mb-1">Current Plan</div>
          <div className="text-white font-display uppercase mb-3">
            {TIER_LABELS[profile?.tier ?? "free"] ?? profile?.tier}
          </div>
          {profile?.tier !== "free" && (
            <>
              <div className="text-jcf-gray text-xs uppercase tracking-widest mb-1">Status</div>
              <div
                className={
                  profile?.subscription_status === "active"
                    ? "text-jcf-success"
                    : profile?.subscription_status === "past_due"
                    ? "text-jcf-danger"
                    : "text-jcf-gray"
                }
              >
                {STATUS_LABELS[profile?.subscription_status ?? "n/a"]}
              </div>
            </>
          )}
        </div>

        {profile?.stripe_customer_id ? (
          <BillingPanel hasStripeCustomer />
        ) : profile?.tier !== "free" ? (
          <div className="bg-jcf-panel border border-white/10 rounded-sm p-4">
            <p className="text-jcf-gray text-sm">
              You have complimentary {TIER_LABELS[profile?.tier ?? ""] ?? profile?.tier} access — no billing on
              file for this plan.
            </p>
          </div>
        ) : (
          <div className="bg-jcf-panel border border-white/10 rounded-sm p-4">
            <p className="text-jcf-gray text-sm mb-3">
              You&apos;re on the free plan. Upgrade for full program editing or direct coaching.
            </p>
            <Link
              href="/pricing"
              className="inline-block bg-jcf-gold text-jcf-black uppercase text-sm font-semibold px-4 py-2 rounded-sm"
            >
              View Plans
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
