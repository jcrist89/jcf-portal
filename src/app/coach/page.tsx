import { requireUser } from "@/lib/auth/require";
import { CoachNav } from "@/components/CoachNav";
import { buildSummary } from "@/lib/clientSummary";
import type { DeviationReport, JokerRequest, Profile, Program, ReadinessCheckin, TrainingMax, WorkoutLog } from "@/lib/types";
import { CoachOverview } from "@/components/CoachOverview";

export default async function CoachHomePage() {
  const { client, session: user } = await requireUser("coach");

  const { data: profiles } = await client
    .from("profiles")
    .select("*")
    .eq("role", "client")
    .order("created_at", { ascending: false });

  const clients = (profiles ?? []) as Profile[];
  const clientIds = clients.map((c) => c.id);
  const programIds = Array.from(new Set(clients.map((c) => c.program_id).filter(Boolean))) as string[];

  // Every one of these is scoped to the clients actually on this page. RLS lets
  // the coach read every row in these tables, so an unscoped select would pull
  // the whole table — including the coach's own personal training rows — and
  // would silently truncate at PostgREST's 1000-row cap as history accumulates,
  // quietly making the summary stats wrong rather than just slow.
  const empty = Promise.resolve({ data: [] });
  const [
    { data: programs },
    { data: allLogs },
    { data: allMeasurements },
    { data: allPrs },
    { data: allTrainingMaxes },
    { data: allJokerRequests },
    { data: allReadiness },
    { data: allDeviations },
  ] = await Promise.all(
    clientIds.length
      ? [
          programIds.length ? client.from("programs").select("*").in("id", programIds) : empty,
          client.from("workout_logs").select("*").in("profile_id", clientIds),
          client.from("measurements").select("profile_id, date").in("profile_id", clientIds),
          client.from("prs").select("profile_id, date").in("profile_id", clientIds),
          client.from("training_maxes").select("*").in("profile_id", clientIds),
          client.from("joker_requests").select("*").in("profile_id", clientIds),
          client.from("readiness_checkins").select("*").in("profile_id", clientIds),
          client.from("deviation_reports").select("*").in("profile_id", clientIds),
        ]
      : [empty, empty, empty, empty, empty, empty, empty, empty],
  );

  const programById = new Map((programs ?? []).map((p: any) => [p.id, p as Program]));
  const logsByProfile = groupBy((allLogs ?? []) as WorkoutLog[], "profile_id");
  const measurementsByProfile = groupBy((allMeasurements ?? []) as any[], "profile_id");
  const prsByProfile = groupBy((allPrs ?? []) as any[], "profile_id");
  const trainingMaxesByProfile = groupBy((allTrainingMaxes ?? []) as TrainingMax[], "profile_id");
  const jokerRequestsByProfile = groupBy((allJokerRequests ?? []) as JokerRequest[], "profile_id");
  const readinessByProfile = groupBy((allReadiness ?? []) as ReadinessCheckin[], "profile_id");
  const deviationsByProfile = groupBy((allDeviations ?? []) as DeviationReport[], "profile_id");

  const summaries = clients.map((c) =>
    buildSummary(
      c,
      c.program_id ? programById.get(c.program_id) ?? null : null,
      logsByProfile[c.id] ?? [],
      measurementsByProfile[c.id] ?? [],
      prsByProfile[c.id] ?? [],
      {
        trainingMaxes: trainingMaxesByProfile[c.id] ?? [],
        jokerRequests: jokerRequestsByProfile[c.id] ?? [],
        readiness: readinessByProfile[c.id] ?? [],
        deviations: deviationsByProfile[c.id] ?? [],
      }
    )
  );

  return (
    <div>
      <CoachNav />
      <main className="px-4 pt-6 max-w-5xl mx-auto pb-24 sm:pb-16">
        <h1 className="font-display text-2xl uppercase tracking-wide mb-1">All Clients</h1>
        <p className="text-jcf-gray text-sm mb-6">Updates live as clients log workouts, check-ins, and PRs.</p>
        <CoachOverview initialSummaries={summaries} viewerId={user.id} />
      </main>
    </div>
  );
}

function groupBy<T extends { profile_id: string }>(items: T[], _key: "profile_id"): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of items) {
    (out[item.profile_id] ??= []).push(item);
  }
  return out;
}
