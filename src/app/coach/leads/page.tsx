import { requireUser } from "@/lib/auth/require";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CoachNav } from "@/components/CoachNav";
import { LeadPipeline } from "@/components/LeadPipeline";

type Lead = {
  id: string;
  cohort_week: string;
  full_name: string | null;
  email: string | null;
  contact_handle: string | null;
  source: string;
  medium: string | null;
  campaign: string | null;
  content_id: string | null;
  inquiry_interest: string | null;
  goal: string | null;
  schedule_context: string | null;
  status: string;
  offer_code: string | null;
  contracted_value_cents: number | null;
  next_action: string | null;
  next_action_due: string | null;
  lost_reason: string | null;
  notes: string | null;
  qualified_at: string | null;
  booked_at: string | null;
  attended_at: string | null;
  won_at: string | null;
  created_at: string;
};

function pct(n: number, d: number) {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : "—";
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function LeadsPage() {
  await requireUser("coach");
  const admin = supabaseAdmin();

  const [{ data: leadRows }, { data: offerRows }] = await Promise.all([
    admin
      .from("jcf_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(250),
    admin
      .from("offers")
      .select("code,name")
      .in("code", [
        "JCF_LOCAL_12W_PIF",
        "JCF_LOCAL_12W_3PAY",
        "JCF_REMOTE_12W_PIF",
        "JCF_PRIVATE_60",
        "JCF_SHIFT_RESET_2026_11",
      ])
      .order("code"),
  ]);

  const leads = (leadRows ?? []) as Lead[];
  const offers = (offerRows ?? []) as Array<{ code: string; name: string }>;
  const today = new Date().toISOString().slice(0, 10);
  const open = leads.filter((lead) => !["won","lost"].includes(lead.status));
  const due = open.filter((lead) => lead.next_action_due && lead.next_action_due <= today);

  const cohorts = new Map<
    string,
    { week: string; leads: number; qualified: number; booked: number; attended: number; won: number; contracted: number }
  >();

  for (const lead of leads) {
    const row = cohorts.get(lead.cohort_week) ?? {
      week: lead.cohort_week,
      leads: 0,
      qualified: 0,
      booked: 0,
      attended: 0,
      won: 0,
      contracted: 0,
    };
    row.leads += 1;
    if (lead.qualified_at) row.qualified += 1;
    if (lead.booked_at) row.booked += 1;
    if (lead.attended_at) row.attended += 1;
    if (lead.won_at) row.won += 1;
    row.contracted += lead.contracted_value_cents ?? 0;
    cohorts.set(lead.cohort_week, row);
  }

  const scorecard = Array.from(cohorts.values())
    .sort((a,b) => b.week.localeCompare(a.week))
    .slice(0, 12);

  return (
    <div className="pb-24">
      <CoachNav />
      <main className="px-4 pt-6 max-w-6xl mx-auto pb-16">
        <div className="mb-6">
          <p className="text-[#FF6B1A] text-xs uppercase tracking-[0.25em] mb-2">Sales Pipeline</p>
          <h1 className="font-display text-4xl uppercase leading-none tracking-wide">Leads + Cohorts</h1>
          <p className="text-jcf-gray text-sm mt-1">
            A lead stays assigned to the week they entered the funnel, even if the sale closes later.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <Metric label="Open leads" value={String(open.length)} />
          <Metric label="Actions due" value={String(due.length)} />
          <Metric label="Won" value={String(leads.filter((lead) => lead.won_at).length)} />
          <Metric label="Contracted" value={money(leads.reduce((sum, lead) => sum + (lead.contracted_value_cents ?? 0), 0))} />
        </div>

        <section className="mb-8">
          <h2 className="font-display uppercase tracking-wide mb-3">Cohort Scorecard</h2>
          {scorecard.length === 0 ? (
            <div className="bg-jcf-panel/80 border border-white/10 shadow-[0_14px_38px_rgba(0,0,0,0.14)] rounded-2xl p-4 text-jcf-gray text-sm">
              Cohort metrics appear after the first lead is logged.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-jcf-panel/40 shadow-[0_14px_38px_rgba(0,0,0,0.14)]">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-jcf-panel text-jcf-gray text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-3">Cohort week</th>
                    <th className="text-right p-3">Leads</th>
                    <th className="text-right p-3">Qualified</th>
                    <th className="text-right p-3">Booked</th>
                    <th className="text-right p-3">Attended</th>
                    <th className="text-right p-3">Won</th>
                    <th className="text-right p-3">Qual.</th>
                    <th className="text-right p-3">Show</th>
                    <th className="text-right p-3">Close</th>
                    <th className="text-right p-3">Contracted</th>
                  </tr>
                </thead>
                <tbody>
                  {scorecard.map((row) => (
                    <tr key={row.week} className="border-t border-white/10">
                      <td className="p-3">{row.week}</td>
                      <td className="p-3 text-right">{row.leads}</td>
                      <td className="p-3 text-right">{row.qualified}</td>
                      <td className="p-3 text-right">{row.booked}</td>
                      <td className="p-3 text-right">{row.attended}</td>
                      <td className="p-3 text-right">{row.won}</td>
                      <td className="p-3 text-right">{pct(row.qualified,row.leads)}</td>
                      <td className="p-3 text-right">{pct(row.attended,row.booked)}</td>
                      <td className="p-3 text-right">{pct(row.won,row.attended)}</td>
                      <td className="p-3 text-right text-[#FF6B1A]">{money(row.contracted)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <LeadPipeline initialLeads={leads} offers={offers} />
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-jcf-panel/80 border border-white/10 shadow-[0_14px_38px_rgba(0,0,0,0.14)] rounded-2xl p-4">
      <div className="font-display text-xl">{value}</div>
      <div className="text-jcf-gray text-[10px] uppercase tracking-widest mt-1">{label}</div>
    </div>
  );
}
