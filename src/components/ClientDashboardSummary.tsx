import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { SectionHeader } from "@/components/SectionHeader";
import type { FlatDay } from "@/lib/program";
import type { WorkoutLog } from "@/lib/types";

/**
 * Presentational dashboard summary — used by both the client's real /dashboard
 * and the coach's read-only "view as client" preview. `viewOnly` disables the
 * one interactive element (the "Go to Program" link), since a coach previewing
 * a client's dashboard shouldn't be one click away from that client's live,
 * writable program editor.
 */
export function ClientDashboardSummary({
  displayName,
  nudge,
  streak,
  lastWeight,
  totalWorkouts,
  upNext,
  recentLogs,
  viewOnly = false,
}: {
  displayName: string;
  nudge: { level: "warning" | "danger"; text: string } | null;
  streak: number;
  lastWeight: number | string;
  totalWorkouts: number;
  upNext: FlatDay | null;
  recentLogs: WorkoutLog[];
  viewOnly?: boolean;
}) {
  return (
    <>
      <div className="mb-6">
        <p className="text-jcf-gray text-xs uppercase tracking-widest">{viewOnly ? "Viewing" : "Welcome back"}</p>
        <h1 className="font-display text-2xl uppercase tracking-wide">{displayName}</h1>
      </div>

      {nudge && (
        <div
          className={`rounded-sm p-3 mb-6 text-sm border ${
            nudge.level === "danger"
              ? "bg-jcf-danger/10 border-jcf-danger/40 text-jcf-danger"
              : "bg-jcf-gold/10 border-jcf-gold/40 text-jcf-gold"
          }`}
        >
          {nudge.text}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard label="Streak" value={`${streak}w`} sub="consecutive weeks" />
        <StatCard label="Weight" value={lastWeight} sub="lb, last logged" />
        <StatCard label="Logged" value={totalWorkouts} sub="total workouts" />
      </div>

      <SectionHeader title="Up Next" />
      <div className="bg-jcf-panel border border-white/10 rounded-sm p-5 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-diagonal-fade" />
        {upNext ? (
          <>
            <div className="text-jcf-gold text-xs uppercase tracking-widest mb-1">Week {upNext.week}</div>
            <div className="font-display text-xl uppercase mb-3">{upNext.label}</div>
            <ul className="text-sm text-jcf-gray space-y-1 mb-4">
              {upNext.exercises.slice(0, 4).map((ex, i) => (
                <li key={i}>
                  {ex.name} — {ex.sets}x{ex.reps}
                </li>
              ))}
              {upNext.exercises.length > 4 && <li>+ {upNext.exercises.length - 4} more</li>}
            </ul>
            {viewOnly ? (
              <span className="inline-block bg-white/10 text-jcf-gray uppercase text-sm px-4 py-2 rounded-sm cursor-not-allowed">
                Go to Program (not available in preview)
              </span>
            ) : (
              <Link
                href="/program"
                className="inline-block bg-jcf-gold text-jcf-black uppercase text-sm font-semibold px-4 py-2 rounded-sm"
              >
                Go to Program
              </Link>
            )}
          </>
        ) : (
          <p className="text-jcf-gray text-sm">No program assigned yet — check back soon.</p>
        )}
      </div>

      <SectionHeader title="Recent Activity" />
      <div className="flex flex-col gap-2">
        {recentLogs.slice(0, 5).map((log) => (
          <div key={log.id} className="flex items-center justify-between bg-jcf-panel border border-white/10 rounded-sm px-4 py-3">
            <div>
              <div className="text-sm text-white">{log.day_label ?? "Workout"}</div>
              <div className="text-xs text-jcf-gray">{log.date}</div>
            </div>
            <span
              className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-sm ${
                log.completed ? "bg-jcf-success/20 text-jcf-success" : "bg-white/10 text-jcf-gray"
              }`}
            >
              {log.completed ? "Done" : "Partial"}
            </span>
          </div>
        ))}
        {recentLogs.length === 0 && (
          <p className="text-jcf-gray text-sm">No workouts logged yet.</p>
        )}
      </div>
    </>
  );
}
