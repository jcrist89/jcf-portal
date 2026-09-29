import { requireUser } from "@/lib/auth/require";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CoachNav } from "@/components/CoachNav";
import { PrivateSessionOps } from "@/components/PrivateSessionOps";
import { shiftResetEnrollmentOpen } from "@/lib/shiftReset";

const SALES_LINKS = [
  { label: "Local Coaching — $399 PIF", href: "https://buy.stripe.com/bJebJ37Kf6tI6cYaqnaIM0j", reset: false },
  { label: "Local Coaching — 3 × $150", href: "https://buy.stripe.com/6oU4gB5C76tIeJu41ZaIM0l", reset: false },
  { label: "Remote Coaching — $997 PIF", href: "https://buy.stripe.com/7sY4gB0hN9FUdFqeGDaIM0g", reset: false },
  { label: "Private Training — $45", href: "https://buy.stripe.com/9B69AV3tZ3hw0SEdCzaIM0e", reset: false },
  { label: "Shift Reset — $27", href: "https://buy.stripe.com/8x26oJ0hN4lA1WIcyvaIM0k", reset: true },
] as const;

function when(value: string) {
  return new Date(value).toLocaleString();
}

export default async function OperationsPage() {
  await requireUser("coach");
  const admin = supabaseAdmin();

  const [
    { data: stalled },
    { data: sessions },
    { data: resetRoster },
    { data: legalDocs },
    { data: legalRequirements },
  ] = await Promise.all([
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
    admin
      .from("jcf_legal_documents")
      .select("document_code,version,title,status")
      .in("document_code", ["terms_of_use","health_disclaimer","coaching_agreement","shift_reset_terms"]),
    admin
      .from("jcf_offer_legal_requirements")
      .select("offer_code,document_code,enabled"),
  ]);

  const stalls = stalled ?? [];
  const privateSessions = sessions ?? [];
  const roster = resetRoster ?? [];
  const resetOpen = shiftResetEnrollmentOpen(roster.length);
  const salesLinks = SALES_LINKS.filter((link) => !link.reset || resetOpen);
  const legalRows = legalDocs ?? [];
  const legalRequirementRows = legalRequirements ?? [];
  const draftLegal = legalRows.filter((row) => row.status !== "active");
  const enabledLegal = legalRequirementRows.filter((row) => row.enabled);
  const legalReady =
    legalRows.length >= 4 &&
    draftLegal.length === 0 &&
    legalRequirementRows.length >= 5 &&
    enabledLegal.length === legalRequirementRows.length;

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
          <div className={`border rounded-sm p-4 ${legalReady ? "border-jcf-success/30 bg-jcf-success/5" : "border-jcf-danger/30 bg-jcf-danger/5"}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display uppercase tracking-wide">Legal Launch Gate</h2>
              <span className={`text-xs uppercase tracking-widest ${legalReady ? "text-jcf-success" : "text-jcf-danger"}`}>
                {legalReady ? "Ready" : "Blocked"}
              </span>
            </div>
            {legalReady ? (
              <p className="text-jcf-gray text-sm mt-2">
                Required legal document versions are active and offer-level acceptance requirements are enabled.
              </p>
            ) : (
              <>
                <p className="text-jcf-gray text-sm mt-2">
                  Agreement acceptance infrastructure is installed, but reviewed legal language has not been activated.
                </p>
                <div className="text-jcf-gray text-xs mt-3">
                  {draftLegal.length} document{draftLegal.length === 1 ? "" : "s"} still draft · {enabledLegal.length}/{legalRequirementRows.length} offer requirements enabled
                </div>
                <p className="text-jcf-danger text-xs mt-2">
                  Do not enable pre-checkout enforcement until the final terms, cancellation/refund language, waiver, and applicable Ohio provisions are reviewed.
                </p>
              </>
            )}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="font-display uppercase tracking-wide mb-3">Coach Sales Links</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {salesLinks.map((link) => (
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
            The 3 × $150 link is intentionally coach-only. Shift Reset checkout appears here only during its enrollment window and while spots remain.
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
