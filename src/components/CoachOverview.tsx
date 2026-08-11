"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { getBrowserClient } from "@/lib/supabase/browser";
import { computeClientSummary, type ClientSummary } from "@/lib/clientSummary";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  paid_programming: "Programming",
  paid_coaching: "Coaching",
};

// Risk is measured from the last logged activity, falling back to signup date
// for clients who've never logged anything yet.
type Risk = "critical" | "warning" | "ok";

function daysQuiet(s: ClientSummary): number {
  const dateStr = s.lastActivity ?? s.profile.created_at;
  return differenceInCalendarDays(new Date(), parseISO(dateStr));
}

function riskFor(s: ClientSummary): Risk {
  const days = daysQuiet(s);
  if (days >= 14) return "critical";
  if (days >= 7) return "warning";
  return "ok";
}

function hasMeetPrepAlert(s: ClientSummary): boolean {
  const a = s.meetPrepAlert;
  if (!a) return false;
  return a.pendingJokers > 0 || a.readinessTier === "very_low" || (a.complianceScore != null && a.complianceScore < 70);
}

export function CoachOverview({
  initialSummaries,
  viewerId,
}: {
  initialSummaries: ClientSummary[];
  viewerId: string;
}) {
  const [summaries, setSummaries] = useState(initialSummaries);
  const [live, setLive] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [search, setSearch] = useState("");
  const summariesRef = useRef(summaries);
  summariesRef.current = summaries;

  const sorted = useMemo(() => {
    return [...summaries].sort((a, b) => {
      if (a.profile.is_active !== b.profile.is_active) return a.profile.is_active ? -1 : 1;
      return daysQuiet(b) - daysQuiet(a);
    });
  }, [summaries]);

  const needsCoachAttention = (s: ClientSummary) => riskFor(s) !== "ok" || hasMeetPrepAlert(s);
  const needsAttention = sorted.filter((s) => s.profile.is_active && needsCoachAttention(s)).length;
  const query = search.trim().toLowerCase();
  const matchesSearch = (s: ClientSummary) =>
    !query ||
    (s.profile.full_name ?? "").toLowerCase().includes(query) ||
    (s.profile.email ?? "").toLowerCase().includes(query);
  const visible = (attentionOnly ? sorted.filter((s) => s.profile.is_active && needsCoachAttention(s)) : sorted).filter(
    matchesSearch
  );

  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function refetch(profileId: string) {
      // The coach's own rows flow through these same tables (they log personal
      // workouts via /coach/my-program) and RLS lets the coach see every row, so
      // their own activity would otherwise add them to their own client grid.
      // Checked before the fetch so a coach's workout doesn't cost 8 queries to
      // then throw away; the role check below covers any other non-client row.
      if (profileId === viewerId) return;
      const updated = await computeClientSummary(supabase, profileId);
      if (!updated || cancelled) return;
      if (updated.profile.role !== "client") return;
      setSummaries((prev) => {
        const exists = prev.some((s) => s.profile.id === profileId);
        if (exists) return prev.map((s) => (s.profile.id === profileId ? updated : s));
        return [updated, ...prev];
      });
    }

    async function setup() {
      // Postgres Changes RLS is evaluated using whatever JWT is currently attached to
      // the realtime socket. supabase-js attaches it asynchronously as auth state
      // resolves, which can lose the race against .subscribe() — so set it explicitly
      // before subscribing rather than relying on that timing (otherwise the channel
      // reports SUBSCRIBED but the connection is anon and RLS silently drops every row).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel("coach-overview")
        .on("postgres_changes", { event: "*", schema: "public", table: "workout_logs" }, (payload: any) => {
          const id = payload.new?.profile_id ?? payload.old?.profile_id;
          if (id) refetch(id);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "measurements" }, (payload: any) => {
          const id = payload.new?.profile_id ?? payload.old?.profile_id;
          if (id) refetch(id);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "prs" }, (payload: any) => {
          const id = payload.new?.profile_id ?? payload.old?.profile_id;
          if (id) refetch(id);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload: any) => {
          const id = payload.new?.id ?? payload.old?.id;
          if (id) refetch(id);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "joker_requests" }, (payload: any) => {
          const id = payload.new?.profile_id ?? payload.old?.profile_id;
          if (id) refetch(id);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "readiness_checkins" }, (payload: any) => {
          const id = payload.new?.profile_id ?? payload.old?.profile_id;
          if (id) refetch(id);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "deviation_reports" }, (payload: any) => {
          const id = payload.new?.profile_id ?? payload.old?.profile_id;
          if (id) refetch(id);
        })
        .subscribe((status: string) => {
          if (!cancelled) setLive(status === "SUBSCRIBED");
        });
    }

    setup();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [viewerId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${live ? "bg-jcf-success" : "bg-jcf-gray"}`} />
            <span className="text-xs uppercase tracking-widest text-jcf-gray">
              {live ? "Live" : "Connecting..."}
            </span>
          </div>
          {needsAttention > 0 && (
            <button
              onClick={() => setAttentionOnly((v) => !v)}
              className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-sm border ${
                attentionOnly
                  ? "bg-jcf-danger text-white border-jcf-danger"
                  : "bg-jcf-danger/15 text-jcf-danger border-jcf-danger/40"
              }`}
            >
              {needsAttention} need{needsAttention === 1 ? "s" : ""} a check-in
            </button>
          )}
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New Client</Button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search clients by name or email..."
        className="w-full sm:w-72 bg-jcf-panel border border-white/15 rounded-sm px-3 py-2 text-sm text-white placeholder:text-jcf-gray/60 focus:outline-none focus:border-jcf-gold mb-4"
      />

      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((s) => {
          const days = daysQuiet(s);
          const risk = riskFor(s);
          const activityLabel = s.lastActivity
            ? `${days}d since last log`
            : `No activity yet · ${days}d since signup`;
          return (
            <Link
              key={s.profile.id}
              href={`/coach/clients/${s.profile.id}`}
              className={`bg-jcf-panel border rounded-sm p-4 hover:border-jcf-gold/50 transition-colors ${
                s.profile.is_active ? "border-white/10" : "border-white/5 opacity-50"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-display uppercase text-white">
                    {s.profile.full_name ?? s.profile.email}
                  </div>
                  <div className="text-[11px] text-jcf-gray uppercase tracking-widest">
                    {s.profile.goal?.replace("_", " ") ?? "No goal set"}
                  </div>
                </div>
                {!s.profile.is_active && (
                  <span className="text-[10px] uppercase text-jcf-danger">Inactive</span>
                )}
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-sm bg-jcf-gold/10 text-jcf-gold">
                  {TIER_LABELS[s.profile.tier] ?? s.profile.tier}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-sm ${
                    s.profile.subscription_status === "active"
                      ? "bg-jcf-success/20 text-jcf-success"
                      : s.profile.subscription_status === "past_due"
                      ? "bg-jcf-danger/20 text-jcf-danger"
                      : "bg-white/10 text-jcf-gray"
                  }`}
                >
                  {s.profile.subscription_status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mt-3">
                <MiniStat label="Streak" value={`${s.streak}w`} />
                <MiniStat label="This Wk" value={`${s.workoutsThisWeek}/${s.plannedPerWeek || "-"}`} />
                <MiniStat label="Total" value={s.totalWorkouts} />
              </div>
              <div
                className={`text-[10px] mt-3 uppercase tracking-widest ${
                  risk === "critical" ? "text-jcf-danger" : risk === "warning" ? "text-jcf-gold" : "text-jcf-gray"
                }`}
              >
                {activityLabel}
              </div>
              {s.meetPrepAlert && hasMeetPrepAlert(s) && (
                <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-0.5">
                  {s.meetPrepAlert.pendingJokers > 0 && (
                    <span className="text-[10px] uppercase tracking-widest text-jcf-gold">
                      {s.meetPrepAlert.pendingJokers} joker request{s.meetPrepAlert.pendingJokers === 1 ? "" : "s"}
                    </span>
                  )}
                  {s.meetPrepAlert.readinessTier === "very_low" && (
                    <span className="text-[10px] uppercase tracking-widest text-jcf-danger">Very low readiness today</span>
                  )}
                  {s.meetPrepAlert.complianceScore != null && s.meetPrepAlert.complianceScore < 70 && (
                    <span className="text-[10px] uppercase tracking-widest text-jcf-danger">
                      Compliance {s.meetPrepAlert.complianceScore}% — {s.meetPrepAlert.complianceCategory}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
        {visible.length === 0 && (
          <p className="text-jcf-gray text-sm col-span-full">
            {summaries.length === 0
              ? "No clients yet — add your first one."
              : query
              ? "No clients match your search."
              : "No one needs a check-in right now."}
          </p>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-sm font-display text-jcf-gold">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-jcf-gray">{label}</div>
    </div>
  );
}

function CreateClientModal({ onClose }: { onClose: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-6" onClick={onClose}>
      <div
        className="bg-jcf-panel border border-white/10 rounded-sm p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center">
            <h3 className="font-display uppercase text-jcf-gold mb-4">Client Created</h3>
            <p className="text-jcf-gray text-sm mb-1">
              An invite email was sent to <span className="text-white">{email}</span> so they can set their
              own password and log in.
            </p>
            <Button onClick={onClose} className="w-full mt-4">Done</Button>
          </div>
        ) : (
          <>
            <h3 className="font-display uppercase text-jcf-gold mb-4">New Client</h3>
            <div className="flex flex-col gap-3">
              <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-jcf-danger text-sm mt-3">{error}</p>}
            <p className="text-jcf-gray text-xs mt-3">
              They&apos;ll get an email invite to set their own password (free tier by default).
            </p>
            <div className="flex gap-3 mt-4">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={create} disabled={saving || !fullName || !email} className="flex-1">
                {saving ? "Creating..." : "Create Client"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
