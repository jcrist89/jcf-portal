import { requireUser } from "@/lib/auth/require";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CoachNav } from "@/components/CoachNav";
import { PrivateSessionOps } from "@/components/PrivateSessionOps";

const SALES_LINKS = [
  { label: "Local Coaching — $399 PIF", href: "https://buy.stripe.com/bJebJ37Kf6tI6cYaqnaIM0j" },
  { label: "Local Coaching — 3 × $150", href: "https://buy.stripe.com/6oU4gB5C76tIeJu41ZaIM0l" },
  { label: "Remote Coaching — $997 PIF", href: "https://buy.stripe.com/7sY4gB0hN9FUdFqeGDaIM0g" },
  { label: "Private Training — $45", href: "https://buy.stripe.com/9B69AV3tZ3hw0SEdCzaIM0e" },
  { label: "Shift Reset — $27", href: "https://buy.stripe.com/8x26oJ0hN4lA1WIcyvaIM0k" },
] as const;

function when(value: string) {
  return new Date(value).toLocaleString();
}

export default async function OperationsPage() {
  await requireUser("coach");
  const admin = supabaseAdmin();

  const [{ data: stalled }, { data: sessions }, { data: resetRoster }] = await Promise.all([
    admin
      .from("jcf_checkout_purchases")
      .select("checkout_session_id, offer_code, customer_email, customer_name, purchased_at")
      .eq("payment_status", "paid")
      .is("activated_at", null)
      .order("purchased_at", { ascending: true })
      .limit(50),
    admin
      .from("jcf_private_session_requests")
      .select("id, customer_email, preferred_days, preferred_time, notes, status, created_at")
      .in("status", ["requested", "scheduled"])
      .order("created_at", { ascending: true })
      .limit(50),
    admin
      .from("jcf_checkout_purchases")
      .select("checkout_session_id, customer_email, customer_name, activated_at, purchased_at")
      .eq("offer_code", "JCF_SHIFT_RESET_2026_11")
      .eq("payment_status", "paid")
      .order("purchased_at", { ascending: true }),
  ]);

  const stalls = stalled ?? [];
  const privateSessions = sessions ?? [];
  const roster = resetRoster ?? [];

  return (
    <div className="pb-24">
      <CoachNav />
      <main className="px-4 pt-6 max-w-4xl mx-auto pb-16">
        <div className="mb-6">
          <p className="text-[#f97316] text-xs uppercase tracking-[0.25em] mb-2">Business Operations</p>
          <h1 className="font-display text-2xl uppercase tracking-wide">What Needs Handled</h1>
          <p className="text-jcf-gray text-sm mt-1">
            Paid checkouts that stalled before activation, private sessions waiting on scheduling, and the Shift Reset roster.
          </p>
        </div>

        <section className="mb-8">
          <h2 className="font-display uppercase tracking-wide mb-3">Coach Sales Links</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {SALES_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-jcf-panel border border-white/10 rounded-sm px-4 py-3 text-sm hover:border-[#f97316]/60 transition-colors"
              >
                <span className="text-white">{link.label}</span>
                <span className="block text-jcf-gray text-xs mt-1">Open secure checkout →</span>
              </a>
            ))}
          </div>
          <p className="text-jcf-gray text-xs mt-3">
            The 3 × $150 link is intentionally coach-only and is not published on the public pricing page.
          </p>
        </section>

        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display uppercase tracking-wide">Paid Checkout Stalls</h2>
            <span className={stalls.length ? "text-jcf-danger text-xs" : "text-jcf-success text-xs"}>
              {stalls.length}
            </span>
          </div>
          {stalls.length === 0 ? (
            <div className="bg-jcf-panel border border-jcf-success/20 rounded-sm p-4 text-jcf-gray text-sm">
              No paid customer is stuck between checkout and onboarding.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {stalls.map((row) => (
                <div key={row.checkout_session_id} className="bg-jcf-panel border border-jcf-danger/30 rounded-sm p-4">
                  <div className="font-medium">{row.customer_name || row.customer_email}</div>
                  <div className="text-jcf-gray text-xs mt-1">{row.offer_code} · paid {when(row.purchased_at)}</div>
                  <div className="text-jcf-gray text-xs mt-1">{row.customer_email}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display uppercase tracking-wide">Private Sessions</h2>
            <span className="text-jcf-gray text-xs">{privateSessions.length} open</span>
          </div>
          <PrivateSessionOps initialRequests={privateSessions} />
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display uppercase tracking-wide">Shift Reset Roster</h2>
            <span className="text-jcf-gray text-xs">{roster.length} / 10 paid</span>
          </div>
          {roster.length === 0 ? (
            <div className="bg-jcf-panel border border-white/10 rounded-sm p-4 text-jcf-gray text-sm">
              No paid Shift Reset participants yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {roster.map((row) => (
                <div key={row.checkout_session_id} className="bg-jcf-panel border border-white/10 rounded-sm p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium">{row.customer_name || row.customer_email}</div>
                    <div className="text-jcf-gray text-xs mt-1">{row.customer_email}</div>
                  </div>
                  <span className={row.activated_at ? "text-jcf-success text-xs uppercase tracking-widest" : "text-jcf-gold text-xs uppercase tracking-widest"}>
                    {row.activated_at ? "Baseline complete" : "Baseline pending"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
