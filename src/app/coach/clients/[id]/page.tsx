import { requireUser } from "@/lib/auth/require";
import { supabaseForRequest } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { CoachNav } from "@/components/CoachNav";
import { ClientDetailView } from "@/components/ClientDetailView";
import type { Achievement, CoachNote, Measurement, PR, Profile, Program, WorkoutLog } from "@/lib/types";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  await requireUser("coach");
  const ctx = await supabaseForRequest();
  if (!ctx) redirect("/login");
  const { client } = ctx;

  const { data: profile } = await client.from("profiles").select("*").eq("id", params.id).maybeSingle();
  if (!profile) notFound();

  const [{ data: measurements }, { data: prs }, { data: workoutLogs }, { data: achievements }, { data: notes }, { data: templates }] =
    await Promise.all([
      client.from("measurements").select("*").eq("profile_id", params.id).order("date", { ascending: true }),
      client.from("prs").select("*").eq("profile_id", params.id).order("date", { ascending: true }),
      client.from("workout_logs").select("*").eq("profile_id", params.id).order("date", { ascending: false }),
      client.from("achievements").select("*").eq("profile_id", params.id).order("date_earned", { ascending: false }),
      client.from("coach_notes").select("*").eq("profile_id", params.id).order("created_at", { ascending: true }),
      client.from("programs").select("id, goal, name").eq("is_template", true),
    ]);

  let program: Program | null = null;
  if (profile.program_id) {
    const { data } = await client.from("programs").select("*").eq("id", profile.program_id).maybeSingle();
    program = (data as Program) ?? null;
  }

  return (
    <div>
      <CoachNav />
      <main className="px-4 pt-6 max-w-3xl mx-auto pb-16">
        <ClientDetailView
          profile={profile as Profile}
          program={program}
          measurements={(measurements ?? []) as Measurement[]}
          prs={(prs ?? []) as PR[]}
          workoutLogs={(workoutLogs ?? []) as WorkoutLog[]}
          achievements={(achievements ?? []) as Achievement[]}
          notes={(notes ?? []) as CoachNote[]}
          templates={(templates ?? []) as { id: string; goal: string; name: string }[]}
        />
      </main>
    </div>
  );
}
