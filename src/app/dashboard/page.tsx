import { requireUser } from "@/lib/auth/require";
import { supabaseForRequest } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClientNav } from "@/components/ClientNav";
import { ClientDashboardSummary } from "@/components/ClientDashboardSummary";
import { nextDayUp } from "@/lib/program";
import { computeStreak, buildNudge, daysSinceLastLog, accountAgeInDays } from "@/lib/dashboardStats";
import type { Profile, Program, WorkoutLog } from "@/lib/types";

export default async function DashboardPage() {
  const user = await requireUser("client");
  const ctx = await supabaseForRequest();
  if (!ctx) redirect("/login");
  const { client } = ctx;

  const { data: profile } = await client.from("profiles").select("*").eq("id", user.id).single();

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

  const lastLogDate = completedLogs[0]?.date ?? null;
  const daysSinceLog = daysSinceLastLog(lastLogDate);
  const accountAgeDays = accountAgeInDays(p.created_at);
  const nudge = buildNudge(daysSinceLog, accountAgeDays, streak);

  return (
    <div className="pb-24">
      <ClientNav />
      <main className="px-4 pt-6 max-w-2xl mx-auto">
        <ClientDashboardSummary
          displayName={p.full_name ?? user.email}
          nudge={nudge}
          streak={streak}
          lastWeight={lastWeight}
          totalWorkouts={completedLogs.length}
          upNext={upNext}
          recentLogs={logs}
        />
      </main>
    </div>
  );
}
