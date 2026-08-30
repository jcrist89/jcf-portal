import { requireUser } from "@/lib/auth/require";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CoachNav } from "@/components/CoachNav";
import { ClientDashboardSummary } from "@/components/ClientDashboardSummary";
import { programPosition } from "@/lib/program";
import { computeStreak, buildNudge, daysSinceLastLog, accountAgeInDays } from "@/lib/dashboardStats";
import type { Profile, Program, WorkoutLog } from "@/lib/types";

/**
 * Coach-only, read-only rendering of what a client's own dashboard looks like.
 * Uses the coach's real session throughout (is_coach() RLS already grants read
 * access to every client's data) — never a session swap, never a write path.
 * The one interactive element on the real dashboard (the "Go to Program" link)
 * is disabled here; everything else is plain display, same as the real page.
 */
export default async function ClientPreviewPage({ params }: { params: { id: string } }) {
  const { client } = await requireUser("coach");

  const { data: profile } = await client.from("profiles").select("*").eq("id", params.id).maybeSingle();
  if (!profile || profile.role !== "client") notFound();

  const [{ data: program }, { data: workoutLogs }] = await Promise.all([
    profile.program_id
      ? client.from("programs").select("*").eq("id", profile.program_id).maybeSingle()
      : Promise.resolve({ data: null }),
    client.from("workout_logs").select("*").eq("profile_id", params.id).order("date", { ascending: false }),
  ]);

  const p = profile as Profile;
  const logs = (workoutLogs ?? []) as WorkoutLog[];
  const completedLogs = logs.filter((l) => l.completed);
  const position = programPosition(
    program as Program | null,
    logs,
    new Date(),
    profile.timezone,
  );

  const streak = computeStreak(completedLogs.map((l) => l.date));
  const lastWeight = p.current_weight ?? p.starting_weight ?? "—";
  const daysSinceLog = daysSinceLastLog(completedLogs[0]?.date ?? null);
  const accountAgeDays = accountAgeInDays(p.created_at);
  const nudge = buildNudge(daysSinceLog, accountAgeDays, streak);

  return (
    <div className="pb-24">
      <CoachNav />
      <main className="px-4 pt-6 max-w-2xl mx-auto">
        <Link
          href={`/coach/clients/${params.id}`}
          className="text-jcf-gray text-xs uppercase tracking-widest hover:text-jcf-gold"
        >
          ← Back to {p.full_name ?? p.email}
        </Link>
        <div className="bg-jcf-gold/10 border border-jcf-gold rounded-sm p-3 my-4 text-sm text-jcf-gold">
          Viewing as {p.full_name ?? p.email} — read-only preview. Nothing here can be edited or submitted.
        </div>
        <ClientDashboardSummary
          displayName={p.full_name ?? p.email ?? "Client"}
          nudge={nudge}
          streak={streak}
          lastWeight={lastWeight}
          totalWorkouts={completedLogs.length}
          position={position}
          recentLogs={logs}
          viewOnly
        />
      </main>
    </div>
  );
}
