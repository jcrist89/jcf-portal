import Link from "next/link";
import { CoachNav } from "@/components/CoachNav";
import { requireUser } from "@/lib/auth/require";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LaunchLinkLibrary } from "@/components/LaunchLinkLibrary";
import { WeeklyBusinessReviewForm } from "@/components/WeeklyBusinessReviewForm";
import {
  CAMPAIGN_TAXONOMY,
  LAUNCH_MILESTONES,
  OCTOBER_BASELINE_TARGETS,
  OCTOBER_TARGET_NOTE,
  addDays,
  mondayOfWeek,
  newYorkDate,
  newYorkMidnightUtc,
  progress,
} from "@/lib/launchOps";

export const dynamic = "force-dynamic";

type Lead = {
  status: string;
  qualified_at: string | null;
  booked_at: string | null;
  attended_at: string | null;
  won_at: string | null;
  contracted_value_cents: number | null;
  next_action_due: string | null;
  lost_reason?: string | null;
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function LaunchOperationsPage() {
  await requireUser("coach");
  const admin = supabaseAdmin();

  const today = newYorkDate();
  const weekStart = mondayOfWeek(today);
  const weekEnd = addDays(weekStart, 7);
  const weekStartIso = newYorkMidnightUtc(weekStart);
  const weekEndIso = newYorkMidnightUtc(weekEnd);
  const last30StartIso = newYorkMidnightUtc(addDays(today, -30));

  const [
    { data: cohortRows },
    { data: openLeadRows },
    { data: wonRows },
    { data: purchases },
    { data: clickRows },
    { data: stalls },
    { data: sessions },
    { data: review },
    { data: lostRows },
    { data: legalDocs },
    { data: legalRequirements },
  ] = await Promise.all([
    admin
      .from("jcf_leads")
      .select("status,qualified_at,booked_at,attended_at,won_at,contracted_value_cents,next_action_due")
      .eq("cohort_week", weekStart),
    admin
      .from("jcf_leads")
      .select("status,next_action_due")
      .not("status", "in", "(won,lost)"),
    admin
      .from("jcf_leads")
      .select("contracted_value_cents,won_at")
      .gte("won_at", weekStartIso)
      .lt("won_at", weekEndIso),
    admin
      .from("jcf_checkout_purchases")
      .select("amount_total,purchased_at")
      .eq("payment_status", "paid")
      .gte("purchased_at", weekStartIso)
      .lt("purchased_at", weekEndIso),
    admin
      .from("jcf_attribution_events")
      .select("content_id,source,medium,campaign,created_at")
      .eq("event_type", "checkout_click")
      .gte("created_at", weekStartIso)
      .lt("created_at", weekEndIso),
    admin
      .from("jcf_checkout_purchases")
      .select("checkout_session_id")
      .eq("payment_status", "paid")
      .is("activated_at", null),
    admin
      .from("jcf_private_session_requests")
      .select("id")
      .in("status", ["requested","scheduled"]),
    admin
      .from("jcf_weekly_business_reviews")
      .select("*")
      .eq("week_start", weekStart)
      .maybeSingle(),
    admin
      .from("jcf_leads")
      .select("lost_reason,lost_at")
      .eq("status", "lost")
      .gte("lost_at", last30StartIso),
    admin
      .from("jcf_legal_documents")
      .select("status"),
    admin
      .from("jcf_offer_legal_requirements")
      .select("enabled"),
  ]);

  const cohort = (cohortRows ?? []) as Lead[];
  const openLeads = (openLeadRows ?? []) as Array<{ status: string; next_action_due: string | null }>;
  const newLeadCount = openLeads.filter((lead) => lead.status === "new").length;
  const dueLeadCount = openLeads.filter(
    (lead) => lead.next_action_due != null && lead.next_action_due <= today,
  ).length;
  const bookedOpenCount = openLeads.filter((lead) => lead.status === "booked").length;

  const cohortMetrics = {
    leads: cohort.length,
    qualified: cohort.filter((lead) => lead.qualified_at).length,
    booked: cohort.filter((lead) => lead.booked_at).length,
    attended: cohort.filter((lead) => lead.attended_at).length,
    won: cohort.filter((lead) => lead.won_at).length,
    contracted: cohort.reduce((sum, lead) => sum + (lead.contracted_value_cents ?? 0), 0),
  };

  const closedThisWeek = (wonRows ?? []).reduce(
    (sum, row) => sum + (row.contracted_value_cents ?? 0),
    0,
  );
  const cashThisWeek = (purchases ?? []).reduce(
    (sum, row) => sum + (row.amount_total ?? 0),
    0,
  );

  const contentCounts = new Map<string, number>();
  for (const row of clickRows ?? []) {
    const key = row.content_id || "(unlabeled)";
    contentCounts.set(key, (contentCounts.get(key) ?? 0) + 1);
  }
  const topContent = Array.from(contentCounts.entries())
    .sort((a,b) => b[1] - a[1])
    .slice(0,3);

  const lostReasons = new Map<string, number>();
  for (const row of lostRows ?? []) {
    const reason = row.lost_reason?.trim() || "(no reason recorded)";
    lostReasons.set(reason, (lostReasons.get(reason) ?? 0) + 1);
  }
  const topLost = Array.from(lostReasons.entries())
    .sort((a,b) => b[1] - a[1])
    .slice(0,3);

  const legalDocRows = legalDocs ?? [];
  const requirementRows = legalRequirements ?? [];
  const legalReady =
    legalDocRows.length >= 4 &&
    legalDocRows.every((row) => row.status === "active") &&
    requirementRows.length >= 5 &&
    requirementRows.every((row) => row.enabled === true);

  const dailyItems = [
    {
      label: "New inquiries",
      value: newLeadCount,
      href: "/coach/leads",
      urgent: newLeadCount > 0,
      copy: "Respond and qualify before creating more content.",
    },
    {
      label: "Follow-ups due",
      value: dueLeadCount,
      href: "/coach/leads",
      urgent: dueLeadCount > 0,
      copy: "Clear every due or overdue next action.",
    },
    {
      label: "Booked prospects",
      value: bookedOpenCount,
      href: "/coach/leads",
      urgent: false,
      copy: "Prep the consult and confirm the next action.",
    },
    {
      label: "Paid onboarding stalls",
      value: (stalls ?? []).length,
      href: "/coach/operations",
      urgent: (stalls ?? []).length > 0,
      copy: "Nobody who paid should be stuck between Stripe and coaching.",
    },
    {
      label: "Private sessions open",
      value: (sessions ?? []).length,
      href: "/coach/operations",
      urgent: false,
      copy: "Schedule or close the request.",
    },
  ];

  return (
    <div className="pb-24">
      <CoachNav />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pt-6 pb-16">
        <div className="mb-6">
          <p className="mb-2 text-xs uppercase tracking-[0.25em] text-[#FF6B1A]">Launch Operations</p>
          <h1 className="font-display text-4xl uppercase leading-none tracking-wide">Run The Business</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-jcf-gray">
            October operating system: clear sales work first, use tagged links, protect delivery, and review one complete funnel every week.
          </p>
        </div>

        <section className="mb-8">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-jcf-gray">Week of {weekStart}</p>
              <h2 className="font-display text-2xl uppercase">Cohort Pace</h2>
            </div>
            <p className="max-w-sm text-right text-[10px] leading-relaxed text-jcf-gray">{OCTOBER_TARGET_NOTE}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Target label="New leads" actual={cohortMetrics.leads} target={OCTOBER_BASELINE_TARGETS.newLeads} />
            <Target label="Qualified" actual={cohortMetrics.qualified} target={OCTOBER_BASELINE_TARGETS.qualified} />
            <Target label="Booked" actual={cohortMetrics.booked} target={OCTOBER_BASELINE_TARGETS.booked} />
            <Target label="Attended" actual={cohortMetrics.attended} target={OCTOBER_BASELINE_TARGETS.attended} />
            <Target label="Won" actual={cohortMetrics.won} target={OCTOBER_BASELINE_TARGETS.won} />
            <Target
              label="Contracted"
              actual={cohortMetrics.contracted}
              target={OCTOBER_BASELINE_TARGETS.contractedCents}
              moneyValue
            />
          </div>
        </section>

        <section className="mb-8 grid gap-3 sm:grid-cols-3">
          <Metric label="Cash collected this week" value={money(cashThisWeek)} />
          <Metric label="Sales closed this week" value={money(closedThisWeek)} />
          <Metric label="Tracked checkout clicks" value={String((clickRows ?? []).length)} />
        </section>

        <section className="mb-8">
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-widest text-jcf-gray">Daily sales block</p>
            <h2 className="font-display text-2xl uppercase">Clear This Before Content</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dailyItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`rounded-2xl border p-4 transition-colors ${
                  item.urgent
                    ? "border-jcf-danger/35 bg-jcf-danger/5"
                    : "border-white/10 bg-jcf-panel/80 hover:border-jcf-blue/30"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-white">{item.label}</span>
                  <span className={item.urgent ? "text-lg font-bold text-jcf-danger" : "text-lg font-bold text-jcf-gold"}>
                    {item.value}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-jcf-gray">{item.copy}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-jcf-panel/80 p-5">
            <p className="text-[10px] uppercase tracking-widest text-jcf-gray">Campaign standard</p>
            <h2 className="mt-1 font-display text-2xl uppercase">October Taxonomy</h2>
            <div className="mt-4 space-y-3 text-sm">
              <TaxonomyRow label="Sources" value={CAMPAIGN_TAXONOMY.sources.join(" · ")} />
              <TaxonomyRow label="Mediums" value={CAMPAIGN_TAXONOMY.mediums.join(" · ")} />
              <TaxonomyRow
                label="Campaigns"
                value={Object.values(CAMPAIGN_TAXONOMY.campaigns).join(" · ")}
              />
              <TaxonomyRow label="Content ID" value={CAMPAIGN_TAXONOMY.contentPattern} />
            </div>
            <Link
              href="/coach/acquisition"
              className="mt-5 inline-block text-xs font-semibold uppercase tracking-widest text-jcf-blue"
            >
              Open acquisition dashboard →
            </Link>
          </div>

          <div className="rounded-2xl border border-white/10 bg-jcf-panel/80 p-5">
            <p className="text-[10px] uppercase tracking-widest text-jcf-gray">Launch gate</p>
            <div className="mt-1 flex items-center justify-between gap-4">
              <h2 className="font-display text-2xl uppercase">Legal</h2>
              <span className={legalReady ? "text-xs uppercase tracking-widest text-jcf-success" : "text-xs uppercase tracking-widest text-jcf-danger"}>
                {legalReady ? "Ready" : "Blocked"}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-jcf-gray">
              {legalReady
                ? "Reviewed document versions and offer-level acceptance requirements are active."
                : "Agreement infrastructure is ready, but reviewed legal documents have not been activated. Sales infrastructure can be tested; do not treat the draft documents as reviewed contracts."}
            </p>
            <Link
              href="/coach/operations"
              className="mt-5 inline-block text-xs font-semibold uppercase tracking-widest text-jcf-blue"
            >
              Open operations →
            </Link>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-widest text-jcf-gray">Tracked links</p>
            <h2 className="font-display text-2xl uppercase">October Link Library</h2>
            <p className="mt-1 text-xs text-jcf-gray">
              Use these defaults when you do not need a unique Content ID. Use the Acquisition builder for individual Reels, Stories, and campaigns.
            </p>
          </div>
          <LaunchLinkLibrary />
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-jcf-panel/80 p-5">
            <p className="text-[10px] uppercase tracking-widest text-jcf-gray">This week</p>
            <h2 className="font-display text-2xl uppercase">Content Signals</h2>
            {topContent.length === 0 ? (
              <p className="mt-3 text-sm text-jcf-gray">No tracked checkout clicks yet this week.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {topContent.map(([content, clicks], index) => (
                  <div key={content} className="flex items-center justify-between gap-4 border-b border-white/10 pb-2">
                    <span className="text-sm text-white">{index + 1}. {content}</span>
                    <span className="text-xs text-jcf-gold">{clicks} click{clicks === 1 ? "" : "s"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-jcf-panel/80 p-5">
            <p className="text-[10px] uppercase tracking-widest text-jcf-gray">Last 30 days</p>
            <h2 className="font-display text-2xl uppercase">Lost Reasons</h2>
            {topLost.length === 0 ? (
              <p className="mt-3 text-sm text-jcf-gray">No lost reasons recorded yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {topLost.map(([reason, count]) => (
                  <div key={reason} className="flex items-start justify-between gap-4 border-b border-white/10 pb-2">
                    <span className="text-sm text-white">{reason}</span>
                    <span className="text-xs text-jcf-gray">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-widest text-jcf-gray">Calendar</p>
            <h2 className="font-display text-2xl uppercase">Launch Milestones</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {LAUNCH_MILESTONES.map((milestone) => {
              const state =
                milestone.date < today ? "Date passed" :
                milestone.date === today ? "Due today" :
                "Upcoming";
              return (
                <div key={milestone.date} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-jcf-panel/80 p-4">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-jcf-gray">{milestone.date}</div>
                    <div className="mt-1 text-sm text-white">{milestone.label}</div>
                  </div>
                  <span className={state === "Due today" ? "text-xs uppercase tracking-widest text-jcf-gold" : "text-[10px] uppercase tracking-widest text-jcf-gray"}>
                    {state}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <WeeklyBusinessReviewForm
            weekStart={weekStart}
            initial={(review as {
              week_start: string;
              wins: string | null;
              bottleneck: string | null;
              next_experiment: string | null;
              decisions: string | null;
              completed_at: string | null;
            } | null) ?? null}
          />
        </section>
      </main>
    </div>
  );
}

function Target({
  label,
  actual,
  target,
  moneyValue = false,
}: {
  label: string;
  actual: number;
  target: number;
  moneyValue?: boolean;
}) {
  const pct = progress(actual, target);
  return (
    <div className="rounded-2xl border border-white/10 bg-jcf-panel/80 p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-jcf-gray">{label}</div>
          <div className="mt-1 font-display text-2xl">
            {moneyValue ? money(actual) : actual}
          </div>
        </div>
        <div className="text-xs text-jcf-gray">/ {moneyValue ? money(target) : target}</div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-[#FF6B1A]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-jcf-panel/80 p-4">
      <div className="font-display text-2xl">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-widest text-jcf-gray">{label}</div>
    </div>
  );
}

function TaxonomyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-jcf-gray">{label}</div>
      <div className="mt-1 break-words font-mono text-xs text-white">{value}</div>
    </div>
  );
}
