import { requireUser } from "@/lib/auth/require";
import { ClientNav } from "@/components/ClientNav";
import { ClientDashboardSummary } from "@/components/ClientDashboardSummary";
import { computeStreak, buildNudge, daysSinceLastLog, accountAgeInDays } from "@/lib/dashboardStats";
import { schedulePosition } from "@/domain/schedule";
import { loadSchedule, loadSessionExercises } from "@/server/schedule";
import { trainingDateIn } from "@/lib/localDate";
import type { WorkoutLog } from "@/lib/types";

export default async function DashboardPage() {
  const { client, session: user, profile: p } = await requireUser("client");

  const today = trainingDateIn(p.timezone);

  const [{ data: workoutLogs }, schedule] = await Promise.all([
    client.from("workout_logs").select("*").eq("profile_id", user.id).order("date", { ascending: false }),
    loadSchedule(client, user.id),
  ]);

  const logs = (workoutLogs ?? []) as WorkoutLog[];
  const completedLogs = logs.filter((l) => l.completed);

  // Which session, and how this block is going, now comes from the materialized
  // schedule rather than from counting logs and indexing into the program jsonb.
  const position = schedulePosition(schedule.assignment, schedule.sessions, today);
  const upNextExercises = position.session
    ? await loadSessionExercises(client, position.session.id)
    : [];

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
          upNextExercises={upNextExercises}
          recentLogs={logs}
        />
      </main>
    </div>
  );
}
