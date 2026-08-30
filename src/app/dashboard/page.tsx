import { requireUser } from "@/lib/auth/require";
import { ClientNav } from "@/components/ClientNav";
import { ClientDashboardSummary } from "@/components/ClientDashboardSummary";
import { programPosition } from "@/lib/program";
import { computeStreak, buildNudge, daysSinceLastLog, accountAgeInDays } from "@/lib/dashboardStats";
import type { Program, WorkoutLog } from "@/lib/types";

export default async function DashboardPage() {
  const { client, session: user, profile: p } = await requireUser("client");

  const [{ data: program }, { data: workoutLogs }] = await Promise.all([
    p.program_id
      ? client.from("programs").select("*").eq("id", p.program_id).maybeSingle()
      : Promise.resolve({ data: null }),
    client.from("workout_logs").select("*").eq("profile_id", user.id).order("date", { ascending: false }),
  ]);

  const logs = (workoutLogs ?? []) as WorkoutLog[];
  const completedLogs = logs.filter((l) => l.completed);
  const position = programPosition(
    program as Program | null,
    logs,
    new Date(),
    p.timezone,
  );

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
          position={position}
          recentLogs={logs}
        />
      </main>
    </div>
  );
}
