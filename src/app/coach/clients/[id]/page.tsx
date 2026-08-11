import { requireUser } from "@/lib/auth/require";
import { notFound } from "next/navigation";
import { CoachNav } from "@/components/CoachNav";
import { ClientDetailView } from "@/components/ClientDetailView";
import type { Achievement, CoachNote, JokerRequest, Measurement, PR, Profile, Program, TrainingMax, WorkoutLog } from "@/lib/types";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const { client } = await requireUser("coach");

  const { data: profile } = await client.from("profiles").select("*").eq("id", params.id).maybeSingle();
  if (!profile) notFound();

  const [
    { data: measurements },
    { data: prs },
    { data: workoutLogs },
    { data: achievements },
    { data: notes },
    { data: templates },
    { data: trainingMaxRows },
    { data: jokerRequestRows },
  ] = await Promise.all([
    client.from("measurements").select("*").eq("profile_id", params.id).order("date", { ascending: true }),
    client.from("prs").select("*").eq("profile_id", params.id).order("date", { ascending: true }),
    client.from("workout_logs").select("*").eq("profile_id", params.id).order("date", { ascending: false }),
    client.from("achievements").select("*").eq("profile_id", params.id).order("date_earned", { ascending: false }),
    client.from("coach_notes").select("*").eq("profile_id", params.id).order("created_at", { ascending: true }),
    client.from("programs").select("id, goal, name").eq("is_template", true),
    client.from("training_maxes").select("*").eq("profile_id", params.id),
    client.from("joker_requests").select("*").eq("profile_id", params.id).order("requested_at", { ascending: false }),
  ]);

  let program: Program | null = null;
  if (profile.program_id) {
    const { data } = await client.from("programs").select("*").eq("id", profile.program_id).maybeSingle();
    program = (data as Program) ?? null;
  }

  return (
    <div>
      <CoachNav />
      <main className="px-4 pt-6 max-w-3xl mx-auto pb-24 sm:pb-16">
        <ClientDetailView
          profile={profile as Profile}
          program={program}
          measurements={(measurements ?? []) as Measurement[]}
          prs={(prs ?? []) as PR[]}
          workoutLogs={(workoutLogs ?? []) as WorkoutLog[]}
          achievements={(achievements ?? []) as Achievement[]}
          notes={(notes ?? []) as CoachNote[]}
          templates={(templates ?? []) as { id: string; goal: string; name: string }[]}
          trainingMaxes={(trainingMaxRows ?? []) as TrainingMax[]}
          jokerRequests={(jokerRequestRows ?? []) as JokerRequest[]}
        />
      </main>
    </div>
  );
}
