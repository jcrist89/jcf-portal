"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getBrowserClient, refreshBrowserAuth } from "@/lib/supabase/browser";
import { computeClientSummary, type ClientSummary } from "@/lib/clientSummary";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

export function CoachOverview({ initialSummaries }: { initialSummaries: ClientSummary[] }) {
  const [summaries, setSummaries] = useState(initialSummaries);
  const [live, setLive] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const summariesRef = useRef(summaries);
  summariesRef.current = summaries;

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setInterval>;

    async function setup() {
      await refreshBrowserAuth();
      if (cancelled) return;
      const supabase = getBrowserClient();

      async function refetch(profileId: string) {
        const updated = await computeClientSummary(supabase, profileId);
        if (!updated || cancelled) return;
        setSummaries((prev) => {
          const exists = prev.some((s) => s.profile.id === profileId);
          if (exists) return prev.map((s) => (s.profile.id === profileId ? updated : s));
          return [updated, ...prev];
        });
      }

      const channel = supabase
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
        .subscribe((status: string) => {
          if (!cancelled) setLive(status === "SUBSCRIBED");
        });

      // Supabase JWTs are short-lived; keep the realtime connection authorized.
      refreshTimer = setInterval(refreshBrowserAuth, 4 * 60 * 1000);

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const cleanupPromise = setup();
    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
      cleanupPromise.then((fn) => fn && fn());
    };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${live ? "bg-jcf-success" : "bg-jcf-gray"}`} />
          <span className="text-xs uppercase tracking-widest text-jcf-gray">
            {live ? "Live" : "Connecting..."}
          </span>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New Client</Button>
      </div>

      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summaries.map((s) => (
          <Link
            key={s.profile.id}
            href={`/coach/clients/${s.profile.id}`}
            className={`bg-jcf-panel border rounded-sm p-4 hover:border-jcf-gold/50 transition-colors ${
              s.profile.is_active ? "border-white/10" : "border-white/5 opacity-50"
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-display uppercase text-white">{s.profile.full_name ?? s.profile.username}</div>
                <div className="text-[11px] text-jcf-gray uppercase tracking-widest">
                  {s.profile.goal?.replace("_", " ") ?? "No goal set"}
                </div>
              </div>
              {!s.profile.is_active && (
                <span className="text-[10px] uppercase text-jcf-danger">Inactive</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mt-3">
              <MiniStat label="Streak" value={`${s.streak}w`} />
              <MiniStat label="This Wk" value={`${s.workoutsThisWeek}/${s.plannedPerWeek || "-"}`} />
              <MiniStat label="Total" value={s.totalWorkouts} />
            </div>
            <div className="text-[10px] text-jcf-gray mt-3 uppercase tracking-widest">
              Last activity: {s.lastActivity ?? "never"}
            </div>
          </Link>
        ))}
        {summaries.length === 0 && (
          <p className="text-jcf-gray text-sm col-span-full">No clients yet — add your first one.</p>
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
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ username: string; pin: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, username }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setResult({ username: data.profile.username, pin: data.pin });
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
        {result ? (
          <div className="text-center">
            <h3 className="font-display uppercase text-jcf-gold mb-4">Client Created</h3>
            <p className="text-jcf-gray text-sm mb-1">Share these login details:</p>
            <div className="bg-jcf-black rounded-sm p-4 my-3">
              <div className="text-sm text-white">Username: <span className="text-jcf-gold">{result.username}</span></div>
              <div className="text-sm text-white">PIN: <span className="text-jcf-gold">{result.pin}</span></div>
            </div>
            <Button onClick={() => location.reload()} className="w-full">Done</Button>
          </div>
        ) : (
          <>
            <h3 className="font-display uppercase text-jcf-gold mb-4">New Client</h3>
            <div className="flex flex-col gap-3">
              <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <Input
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              />
            </div>
            {error && <p className="text-jcf-danger text-sm mt-3">{error}</p>}
            <p className="text-jcf-gray text-xs mt-3">A random 6-digit PIN will be generated automatically.</p>
            <div className="flex gap-3 mt-4">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={create} disabled={saving || !fullName || !username} className="flex-1">
                {saving ? "Creating..." : "Create Client"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
