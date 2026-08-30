import Link from "next/link";
import { requireUser } from "@/lib/auth/require";
import { ClientNav } from "@/components/ClientNav";
import { CheckinForm } from "@/components/CheckinForm";
import { checkinState, currentCheckinDate, type Checkin } from "@/domain/checkin";
import { trainingDateIn } from "@/lib/localDate";
import type { Engagement } from "@/domain/engagement";

export default async function CheckinPage() {
  const { client, session: user, profile } = await requireUser("client");

  const today = trainingDateIn(profile.timezone);
  const [{ data: engagementRow }, { data: rows }] = await Promise.all([
    client
      .from("client_engagements")
      .select("*")
      .eq("profile_id", user.id)
      .in("status", ["pending", "active", "past_due"])
      .maybeSingle(),
    client
      .from("checkins")
      .select("*")
      .eq("profile_id", user.id)
      .order("due_local_date", { ascending: false })
      .limit(8),
  ]);

  const engagement = (engagementRow as Engagement | null) ?? null;
  const checkins = (rows ?? []) as Checkin[];
  const dueOn = currentCheckinDate(engagement, today);
  const state = checkinState(
    engagement,
    checkins.find((c) => c.due_local_date === dueOn) ?? null,
    today,
    new Date().toISOString(),
  );
  const current = checkins.find((c) => c.due_local_date === state.dueOn) ?? null;

  return (
    <div className="pb-24">
      <ClientNav />
      <main className="px-4 pt-6 max-w-2xl mx-auto">
        <h1 className="font-display text-2xl uppercase tracking-wide mb-1">Check-In</h1>

        {current?.submitted_at ? (
          <div className="bg-jcf-panel border border-jcf-success/40 rounded-sm p-5 mb-6">
            <p className="text-jcf-success uppercase text-xs tracking-widest mb-2">Sent</p>
            <p className="text-jcf-gray text-sm mb-3">
              This week&apos;s check-in is with Jon. He&apos;ll come back to you.
            </p>
            {current.coach_response ? (
              <>
                <p className="text-[10px] uppercase tracking-wider text-jcf-gray mb-1">Jon said</p>
                <p className="text-white text-sm whitespace-pre-wrap">{current.coach_response}</p>
              </>
            ) : (
              <Link href="/messages" className="text-jcf-gold text-xs uppercase tracking-widest hover:underline">
                Go to messages →
              </Link>
            )}
          </div>
        ) : !engagement ? (
          <p className="text-jcf-gray text-sm">
            Your check-in schedule starts once Jon sets up your coaching block.
          </p>
        ) : (
          <>
            {state.status === "overdue" && (
              <div className="rounded-sm p-3 mb-4 text-sm border bg-jcf-gold/10 border-jcf-gold/40 text-jcf-gold">
                This one&apos;s {state.daysOverdue} day{state.daysOverdue === 1 ? "" : "s"} late. Two minutes and
                it&apos;s done.
              </div>
            )}
            <CheckinForm profileId={user.id} dueOn={state.dueOn ?? today} initial={null} />
          </>
        )}

        {checkins.filter((c) => c.submitted_at && c.id !== current?.id).length > 0 && (
          <section className="mt-10">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-jcf-gray mb-3">Previous</h2>
            <div className="flex flex-col gap-2">
              {checkins
                .filter((c) => c.submitted_at && c.id !== current?.id)
                .map((c) => (
                  <div key={c.id} className="bg-jcf-panel border border-white/10 rounded-sm px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-white">{c.due_local_date}</span>
                      <span className="text-xs text-jcf-gray">
                        {c.weight != null && `${c.weight} lb`}
                        {c.waist != null && ` · ${c.waist} in`}
                      </span>
                    </div>
                    {c.coach_response && (
                      <p className="text-jcf-gray text-xs mt-2 whitespace-pre-wrap">{c.coach_response}</p>
                    )}
                  </div>
                ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
