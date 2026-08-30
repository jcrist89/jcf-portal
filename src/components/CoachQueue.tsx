"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CoachSignal, QueueEntry, Severity } from "@/domain/signals";

const SEVERITY_STYLES: Record<Severity, { chip: string; rail: string; label: string }> = {
  critical: { chip: "text-jcf-danger border-jcf-danger", rail: "bg-jcf-danger", label: "Now" },
  high: { chip: "text-jcf-gold border-jcf-gold", rail: "bg-jcf-gold", label: "Soon" },
  opportunity: { chip: "text-jcf-success border-jcf-success", rail: "bg-jcf-success", label: "Worth doing" },
};

/**
 * "Who needs me today", as a ranked work queue.
 *
 * Clients with nothing wrong are absent. A list containing everyone is a client grid,
 * and this is deliberately not one — the coach already has that view, and a queue whose
 * length equals the roster is one nobody opens twice.
 *
 * Every signal shows its evidence. A coach who can't see why the app flagged someone
 * has to take it on faith, and faith in a triage list survives about two false alarms.
 */
export function CoachQueue({
  initialQueue,
  clientCount,
}: {
  initialQueue: QueueEntry[];
  clientCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function act(profileId: string, signal: CoachSignal, action: "snoozed" | "resolved") {
    const key = `${profileId}:${signal.kind}`;
    setBusy(key);
    setFailed(null);
    try {
      const res = await fetch("/api/coach/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          signalKind: signal.kind,
          fingerprint: signal.fingerprint,
          action,
        }),
      });
      if (!res.ok) throw new Error("failed");
      router.refresh();
    } catch {
      setFailed(key);
    } finally {
      setBusy(null);
    }
  }

  if (initialQueue.length === 0) {
    return (
      <div className="bg-jcf-panel border border-jcf-success/30 rounded-sm p-6 text-center">
        <p className="font-display uppercase tracking-wide text-jcf-success mb-1">Nobody needs you right now</p>
        <p className="text-jcf-gray text-sm">
          All {clientCount} active {clientCount === 1 ? "client is" : "clients are"} on track.
        </p>
      </div>
    );
  }

  const critical = initialQueue.filter((e) => e.topSeverity === "critical").length;

  return (
    <div>
      <p className="text-jcf-gray text-sm mb-5">
        {initialQueue.length} of {clientCount} {clientCount === 1 ? "client needs" : "clients need"} something
        {critical > 0 && <span className="text-jcf-danger"> · {critical} today</span>}
      </p>

      <div className="flex flex-col gap-3">
        {initialQueue.map((entry) => (
          <article
            key={entry.profileId}
            className="bg-jcf-panel border border-white/10 rounded-sm overflow-hidden flex"
          >
            <div className={`w-1 shrink-0 ${SEVERITY_STYLES[entry.topSeverity].rail}`} aria-hidden="true" />
            <div className="flex-1 p-4 min-w-0">
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <Link
                  href={`/coach/clients/${entry.profileId}`}
                  className="font-display uppercase tracking-wide text-white hover:text-jcf-gold truncate"
                >
                  {entry.name}
                </Link>
                <span
                  className={`shrink-0 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-sm border ${
                    SEVERITY_STYLES[entry.topSeverity].chip
                  }`}
                >
                  {SEVERITY_STYLES[entry.topSeverity].label}
                </span>
              </div>

              <ul className="flex flex-col gap-3">
                {entry.signals.map((signal) => {
                  const key = `${entry.profileId}:${signal.kind}`;
                  return (
                    <li key={signal.kind} className="border-t border-white/5 pt-3 first:border-0 first:pt-0">
                      <div className="text-sm text-white mb-0.5">{signal.headline}</div>
                      <p className="text-jcf-gray text-xs mb-2">{signal.evidence}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={
                            signal.kind === "message_unanswered"
                              ? `/coach/clients/${entry.profileId}?tab=messages`
                              : `/coach/clients/${entry.profileId}`
                          }
                          className="text-jcf-gold text-xs uppercase tracking-widest hover:underline"
                        >
                          {signal.action} →
                        </Link>
                        <span className="text-white/15" aria-hidden="true">
                          |
                        </span>
                        <button
                          type="button"
                          disabled={busy === key}
                          onClick={() => act(entry.profileId, signal, "resolved")}
                          className="text-jcf-gray text-xs uppercase tracking-widest hover:text-white disabled:opacity-50"
                        >
                          Done
                        </button>
                        <button
                          type="button"
                          disabled={busy === key}
                          onClick={() => act(entry.profileId, signal, "snoozed")}
                          className="text-jcf-gray text-xs uppercase tracking-widest hover:text-white disabled:opacity-50"
                        >
                          Snooze 3d
                        </button>
                        {failed === key && (
                          <span role="status" className="text-jcf-danger text-xs">
                            Didn&apos;t save — try again.
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
