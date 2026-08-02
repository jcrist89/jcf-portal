import { requireUser } from "@/lib/auth/require";
import { supabaseForRequest } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CoachNav } from "@/components/CoachNav";

const PAGE_SIZE = 30;

const LEVEL_STYLES: Record<string, string> = {
  error: "text-jcf-danger",
  warning: "text-jcf-gold",
  info: "text-jcf-gray",
};

/**
 * Coach-only operational visibility: recent failures/warnings from the cron
 * job, Stripe webhook, push notifications, and workout saves — logged via
 * src/lib/eventLog.ts. Never shows Stripe ids, amounts, or other billing
 * internals; context is limited to what each call site chose to record (see
 * each logEvent() call for exactly what's included).
 */
export default async function MonitoringPage({ searchParams }: { searchParams: { before?: string } }) {
  await requireUser("coach");
  const ctx = await supabaseForRequest();
  if (!ctx) redirect("/login");
  const { client } = ctx;

  let query = client
    .from("event_log")
    .select("id, level, source, message, context, profile_id, created_at")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (searchParams.before) query = query.lt("created_at", searchParams.before);

  const { data: events } = await query;
  const rows = events ?? [];
  const nextCursor = rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : null;

  return (
    <div className="pb-24">
      <CoachNav />
      <main className="px-4 pt-6 max-w-3xl mx-auto pb-16">
        <h1 className="font-display text-2xl uppercase tracking-wide mb-1">Monitoring</h1>
        <p className="text-jcf-gray text-sm mb-6">
          Recent failures and warnings from scheduled jobs, payments, and notifications.
        </p>

        {rows.length === 0 ? (
          <p className="text-jcf-gray text-sm">Nothing logged — everything&apos;s been running clean.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((e) => (
              <div key={e.id} className="bg-jcf-panel border border-white/10 rounded-sm px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className={`text-xs uppercase tracking-widest mr-2 ${LEVEL_STYLES[e.level] ?? "text-jcf-gray"}`}>
                      {e.level}
                    </span>
                    <span className="text-jcf-gray text-xs uppercase tracking-widest mr-2">{e.source}</span>
                    <span>{e.message}</span>
                  </div>
                  <span className="text-jcf-gray text-xs shrink-0">{new Date(e.created_at).toLocaleString()}</span>
                </div>
                {e.context && Object.keys(e.context).length > 0 && (
                  <pre className="text-jcf-gray text-xs mt-2 whitespace-pre-wrap break-all">
                    {JSON.stringify(e.context)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {nextCursor && (
          <Link
            href={`/coach/monitoring?before=${encodeURIComponent(nextCursor)}`}
            className="inline-block mt-4 border border-white/15 text-jcf-gray uppercase text-xs tracking-widest px-4 py-2 rounded-sm hover:text-jcf-gold"
          >
            Load more
          </Link>
        )}
      </main>
    </div>
  );
}
