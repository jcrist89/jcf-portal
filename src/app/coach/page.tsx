import { requireUser } from "@/lib/auth/require";
import { supabaseForRequest } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CoachNav } from "@/components/CoachNav";
import { buildSummary } from "@/lib/clientSummary";
import type { Profile, Program, WorkoutLog } from "@/lib/types";
import { CoachOverview } from "@/components/CoachOverview";

export default async function CoachHomePage() {
  await requireUser("coach");
  const ctx = await supabaseForRequest();
  if (!ctx) redirect("/login");
  const { client } = ctx;

  const { data: profiles } = await client
    .from("profiles")
    .select("*")
    .eq("role", "client")
    .order("created_at", { ascending: false });

  const clients = (profiles ?? []) as Profile[];
  const programIds = Array.from(new Set(clients.map((c) => c.program_id).filter(Boolean))) as string[];

  const [{ data: programs }, { data: allLogs }, { data: allMeasurements }, { data: allPrs }] = await Promise.all([
    programIds.length
      ? client.from("programs").select("*").in("id", programIds)
      : Promise.resolve({ data: [] }),
    client.from("workout_logs").select("*"),
    client.from("measurements").select("profile_id, date"),
    client.from("prs").select("profile_id, date"),
  ]);

  const programById = new Map((programs ?? []).map((p: any) => [p.id, p as Program]));
  const logsByProfile = groupBy((allLogs ?? []) as WorkoutLog[], "profile_id");
  const measurementsByProfile = groupBy((allMeasurements ?? []) as any[], "profile_id");
  const prsByProfile = groupBy((allPrs ?? []) as any[], "profile_id");

  const summaries = clients.map((c) =>
    buildSummary(
      c,
      c.program_id ? programById.get(c.program_id) ?? null : null,
      logsByProfile[c.id] ?? [],
      measurementsByProfile[c.id] ?? [],
      prsByProfile[c.id] ?? []
    )
  );

  return (
    <div>
      <CoachNav />
      <main className="px-4 pt-6 max-w-5xl mx-auto pb-16">
        <h1 className="font-display text-2xl uppercase tracking-wide mb-1">All Clients</h1>
        <p className="text-jcf-gray text-sm mb-6">Updates live as clients log workouts, check-ins, and PRs.</p>
        <CoachOverview initialSummaries={summaries} />
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
