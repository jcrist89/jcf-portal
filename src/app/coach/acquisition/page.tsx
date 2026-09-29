import { requireUser } from "@/lib/auth/require";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CoachNav } from "@/components/CoachNav";
import { AttributionLinkBuilder } from "@/components/AttributionLinkBuilder";

type EventRow = {
  offer_code: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content_id: string | null;
  created_at: string;
};

type AttributionRow = {
  checkout_session_id: string;
  offer_code: string | null;
  first_source: string | null;
  first_campaign: string | null;
  first_content_id: string | null;
  last_source: string | null;
  last_medium: string | null;
  last_campaign: string | null;
  last_content_id: string | null;
  attributed_at: string;
};

type PurchaseRow = {
  checkout_session_id: string;
  offer_code: string;
  amount_total: number;
  payment_status: string;
  purchased_at: string;
};

type OfferRow = {
  code: string;
  amount_cents: number;
  installments: number | null;
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function pct(numerator: number, denominator: number) {
  return denominator > 0 ? `${Math.round((numerator / denominator) * 100)}%` : "—";
}

function label(value: string | null | undefined) {
  return value?.trim() || "(unattributed)";
}

export default async function AcquisitionPage() {
  await requireUser("coach");
  const admin = supabaseAdmin();
  // Request-time Server Component snapshot.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [
    { data: clickRows },
    { data: attributionRows },
    { data: purchaseRows },
    { data: offerRows },
  ] = await Promise.all([
    admin
      .from("jcf_attribution_events")
      .select("offer_code,source,medium,campaign,content_id,created_at")
      .eq("event_type", "checkout_click")
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    admin
      .from("jcf_checkout_attribution")
      .select("checkout_session_id,offer_code,first_source,first_campaign,first_content_id,last_source,last_medium,last_campaign,last_content_id,attributed_at")
      .gte("attributed_at", since),
    admin
      .from("jcf_checkout_purchases")
      .select("checkout_session_id,offer_code,amount_total,payment_status,purchased_at")
      .eq("payment_status", "paid")
      .gte("purchased_at", since),
    admin
      .from("offers")
      .select("code,amount_cents,installments")
      .like("code", "JCF_%"),
  ]);

  const clicks = (clickRows ?? []) as EventRow[];
  const attributions = (attributionRows ?? []) as AttributionRow[];
  const purchases = (purchaseRows ?? []) as PurchaseRow[];
  const offers = new Map(
    ((offerRows ?? []) as OfferRow[]).map((offer) => [offer.code, offer]),
  );
  const attributionBySession = new Map(
    attributions.map((row) => [row.checkout_session_id, row]),
  );

  let cashCents = 0;
  let contractedCents = 0;
  let attributedPurchases = 0;

  const performance = new Map<
    string,
    {
      source: string;
      medium: string;
      campaign: string;
      content: string;
      clicks: number;
      purchases: number;
      cash: number;
      contracted: number;
    }
  >();

  function keyFor(source: string, medium: string, campaign: string, content: string) {
    return [source, medium, campaign, content].join("||");
  }

  for (const click of clicks) {
    const source = label(click.source);
    const medium = label(click.medium);
    const campaign = label(click.campaign);
    const content = label(click.content_id);
    const key = keyFor(source, medium, campaign, content);
    const existing = performance.get(key) ?? {
      source, medium, campaign, content, clicks: 0, purchases: 0, cash: 0, contracted: 0,
    };
    existing.clicks += 1;
    performance.set(key, existing);
  }

  for (const purchase of purchases) {
    cashCents += purchase.amount_total;
    const offer = offers.get(purchase.offer_code);
    const contracted =
      offer != null
        ? offer.amount_cents * Math.max(1, offer.installments ?? 1)
        : purchase.amount_total;
    contractedCents += contracted;

    const attribution = attributionBySession.get(purchase.checkout_session_id);
    if (!attribution) continue;
    attributedPurchases += 1;

    const source = label(attribution.last_source);
    const medium = label(attribution.last_medium);
    const campaign = label(attribution.last_campaign);
    const content = label(attribution.last_content_id);
    const key = keyFor(source, medium, campaign, content);
    const existing = performance.get(key) ?? {
      source, medium, campaign, content, clicks: 0, purchases: 0, cash: 0, contracted: 0,
    };
    existing.purchases += 1;
    existing.cash += purchase.amount_total;
    existing.contracted += contracted;
    performance.set(key, existing);
  }

  const rows = Array.from(performance.values()).sort(
    (a, b) => b.contracted - a.contracted || b.purchases - a.purchases || b.clicks - a.clicks,
  );

  const firstTouch = new Map<string, { source: string; purchases: number; cash: number; contracted: number }>();
  for (const purchase of purchases) {
    const attribution = attributionBySession.get(purchase.checkout_session_id);
    if (!attribution) continue;
    const source = label(attribution.first_source);
    const offer = offers.get(purchase.offer_code);
    const contracted =
      offer != null
        ? offer.amount_cents * Math.max(1, offer.installments ?? 1)
        : purchase.amount_total;
    const existing = firstTouch.get(source) ?? { source, purchases: 0, cash: 0, contracted: 0 };
    existing.purchases += 1;
    existing.cash += purchase.amount_total;
    existing.contracted += contracted;
    firstTouch.set(source, existing);
  }

  const firstRows = Array.from(firstTouch.values()).sort((a, b) => b.contracted - a.contracted);

  return (
    <div className="pb-24">
      <CoachNav />
      <main id="main-content" tabIndex={-1} className="px-4 pt-6 max-w-6xl mx-auto pb-16">
        <div className="mb-6">
          <p className="text-[#FF6B1A] text-xs uppercase tracking-[0.25em] mb-2">Acquisition</p>
          <h1 className="font-display text-4xl uppercase leading-none tracking-wide">What Actually Produces Sales</h1>
          <p className="text-jcf-gray text-sm mt-1">
            Rolling 30-day view. Cash collected and contracted sales are intentionally separate.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
          <Metric label="Checkout clicks" value={String(clicks.length)} />
          <Metric label="Paid checkouts" value={String(purchases.length)} />
          <Metric label="Cash collected" value={money(cashCents)} />
          <Metric label="Contracted" value={money(contractedCents)} />
          <Metric label="Attribution coverage" value={pct(attributedPurchases, purchases.length)} />
        </div>

        <section className="mb-8">
          <h2 className="font-display uppercase tracking-wide mb-3">Build A Trackable Link</h2>
          <AttributionLinkBuilder />
        </section>

        <section className="mb-8">
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <div>
              <h2 className="font-display uppercase tracking-wide">Last-Touch Performance</h2>
              <p className="text-jcf-gray text-xs mt-1">What immediately preceded the checkout.</p>
            </div>
          </div>
          {rows.length === 0 ? (
            <Empty text="No tracked checkout activity yet." />
          ) : (
            <div className="overflow-x-auto border border-white/10 rounded-2xl">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-jcf-panel text-jcf-gray text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-3">Source</th>
                    <th className="text-left p-3">Medium</th>
                    <th className="text-left p-3">Campaign</th>
                    <th className="text-left p-3">Content</th>
                    <th className="text-right p-3">Clicks</th>
                    <th className="text-right p-3">Sales</th>
                    <th className="text-right p-3">Conv.</th>
                    <th className="text-right p-3">Cash</th>
                    <th className="text-right p-3">Contracted</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={keyFor(row.source,row.medium,row.campaign,row.content)} className="border-t border-white/10">
                      <td className="p-3">{row.source}</td>
                      <td className="p-3 text-jcf-gray">{row.medium}</td>
                      <td className="p-3 text-jcf-gray">{row.campaign}</td>
                      <td className="p-3 text-jcf-gray">{row.content}</td>
                      <td className="p-3 text-right">{row.clicks}</td>
                      <td className="p-3 text-right">{row.purchases}</td>
                      <td className="p-3 text-right">{pct(row.purchases,row.clicks)}</td>
                      <td className="p-3 text-right">{money(row.cash)}</td>
                      <td className="p-3 text-right text-[#FF6B1A]">{money(row.contracted)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display uppercase tracking-wide mb-1">First-Touch Origin</h2>
          <p className="text-jcf-gray text-xs mb-3">Where the buyer first entered a tagged JCF path.</p>
          {firstRows.length === 0 ? (
            <Empty text="No attributed purchases yet." />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {firstRows.map((row) => (
                <div key={row.source} className="bg-jcf-panel/80 border border-white/10 shadow-[0_14px_38px_rgba(0,0,0,0.14)] rounded-2xl p-4">
                  <div className="font-display uppercase">{row.source}</div>
                  <div className="text-jcf-gray text-xs mt-1">{row.purchases} paid checkout{row.purchases === 1 ? "" : "s"}</div>
                  <div className="mt-3 text-sm">{money(row.cash)} cash</div>
                  <div className="text-[#FF6B1A] text-sm">{money(row.contracted)} contracted</div>
                </div>
              ))}
            </div>
          )}
        </section>
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

function Empty({ text }: { text: string }) {
  return <div className="bg-jcf-panel/80 border border-white/10 shadow-[0_14px_38px_rgba(0,0,0,0.14)] rounded-2xl p-4 text-jcf-gray text-sm">{text}</div>;
}
