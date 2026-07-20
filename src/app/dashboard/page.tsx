import { requireUser } from "@/lib/auth/require";
import { supabaseForRequest } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClientNav } from "@/components/ClientNav";
import { StatCard } from "@/components/StatCard";
import { SectionHeader } from "@/components/SectionHeader";
import { nextDayUp } from "@/lib/program";
import { differenceInCalendarWeeks, parseISO } from "date-fns";
import type { Profile, Program, WorkoutLog } from "@/lib/types";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await requireUser("client");
  const ctx = await supabaseForRequest();
  if (!ctx) redirect("/login");
  const { client } = ctx;

  const { data: profile } = await client.from("profiles").select("*").eq("id", user.id).single();
  if (!profile?.onboarded) redirect("/onboarding");

  const [{ data: program }, { data: workoutLogs }] = await Promise.all([
    profile.program_id
      ? client.from("programs").select("*").eq("id", profile.program_id).maybeSingle()
      : Promise.resolve({ data: null }),
    client.from("workout_logs").select("*").eq("profile_id", user.id).order("date", { ascending: false }),
  ]);

  const p = profile as Profile;
  const logs = (workoutLogs ?? []) as WorkoutLog[];
  const completedLogs = logs.filter((l) => l.completed);
  const upNext = nextDayUp(program as Program | null, completedLogs.length);

  const streak = computeStreak(completedLogs.map((l) => l.date));
  const lastWeight = p.current_weight ?? p.starting_weight ?? "—";

  return (
    <div className="pb-24">
      <ClientNav />
      <main className="px-4 pt-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <p className="text-jcf-gray text-xs uppercase tracking-widest">Welcome back</p>
          <h1 className="font-display text-2xl uppercase tracking-wide">{p.full_name ?? user.username}</h1>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <StatCard label="Streak" value={`${streak}w`} sub="consecutive weeks" />
          <StatCard label="Weight" value={lastWeight} sub="lb, last logged" />
          <StatCard label="Logged" value={completedLogs.length} sub="total workouts" />
        </div>

        <SectionHeader title="Up Next" />
        <div className="bg-jcf-panel border border-white/10 rounded-sm p-5 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-diagonal-fade" />
          {upNext ? (
            <>
              <div className="text-jcf-gold text-xs uppercase tracking-widest mb-1">
                Week {upNext.week}
              </div>
              <div className="font-display text-xl uppercase mb-3">{upNext.label}</div>
              <ul className="text-sm text-jcf-gray space-y-1 mb-4">
                {upNext.exercises.slice(0, 4).map((ex, i) => (
                  <li key={i}>
                    {ex.name} — {ex.sets}x{ex.reps}
                  </li>
                ))}
                {upNext.exercises.length > 4 && <li>+ {upNext.exercises.length - 4} more</li>}
              </ul>
              <Link
                href="/program"
                className="inline-block bg-jcf-gold text-jcf-black uppercase text-sm font-semibold px-4 py-2 rounded-sm"
              >
                Go to Program
              </Link>
            </>
          ) : (
            <p className="text-jcf-gray text-sm">No program assigned yet — check back soon.</p>
          )}
        </div>

        <SectionHeader title="Recent Activity" />
        <div className="flex flex-col gap-2">
          {logs.slice(0, 5).map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between bg-jcf-panel border border-white/10 rounded-sm px-4 py-3"
            >
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
          {logs.length === 0 && (
            <p className="text-jcf-gray text-sm">No workouts logged yet. Log your first one from My Program.</p>
          )}
        </div>
      </main>
    </div>
  );
}

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = dates.map((d) => parseISO(d)).sort((a, b) => a.getTime() - b.getTime());
  const weeks = Array.from(
    new Set(sorted.map((d) => differenceInCalendarWeeks(d, sorted[0], { weekStartsOn: 1 })))
  ).sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < weeks.length; i++) {
    if (weeks[i] === weeks[i - 1] + 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else run = 1;
  }
  return longest;
}
