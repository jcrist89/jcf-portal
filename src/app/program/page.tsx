import { requireUser } from "@/lib/auth/require";
import { supabaseForRequest } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClientNav } from "@/components/ClientNav";
import { flattenProgram } from "@/lib/program";
import type { Profile, Program, WorkoutLog, TrainingMax } from "@/lib/types";
import { ProgramLogger } from "@/components/ProgramLogger";

export default async function ProgramPage() {
  const user = await requireUser("client");
  const ctx = await supabaseForRequest();
  if (!ctx) redirect("/login");
  const { client } = ctx;

  const { data: profile } = await client.from("profiles").select("*").eq("id", user.id).single();
  if (!profile?.onboarded) redirect("/onboarding");

  const [{ data: program }, { data: workoutLogs }, { data: trainingMaxRows }] = await Promise.all([
    profile.program_id
      ? client.from("programs").select("*").eq("id", profile.program_id).maybeSingle()
      : Promise.resolve({ data: null }),
    client.from("workout_logs").select("*").eq("profile_id", user.id).order("date", { ascending: false }),
    client.from("training_maxes").select("*").eq("profile_id", user.id),
  ]);

  const p = program as Program | null;
  const flat = flattenProgram(p);
  const logs = (workoutLogs ?? []) as WorkoutLog[];
  const completedCount = logs.filter((l) => l.completed).length;

  const trainingMaxes: Record<string, number> = {};
  for (const row of (trainingMaxRows ?? []) as TrainingMax[]) {
    trainingMaxes[row.lift] = Number(row.weight);
  }

  const daysToMeet =
    p && (p as any).meet_date
      ? Math.ceil((new Date((p as any).meet_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

  return (
    <div className="pb-24">
      <ClientNav />
      <main className="px-4 pt-6 max-w-2xl mx-auto">
        <h1 className="font-display text-2xl uppercase tracking-wide mb-1">My Program</h1>
        {p ? (
          <p className="text-jcf-gray text-sm mb-4">{p.name} — {p.description}</p>
        ) : (
          <p className="text-jcf-gray text-sm mb-6">No program assigned yet.</p>
        )}

        {p && (p as any).meet_date && daysToMeet != null && (
          <div className="bg-jcf-panel border border-white/10 rounded-sm p-4 mb-6 flex items-center justify-between">
            <div>
              <div className="font-display text-3xl text-white">{daysToMeet}</div>
              <div className="text-[10px] uppercase tracking-wider text-jcf-gray">Days to Platform</div>
            </div>
            <div className="text-right text-xs text-jcf-gray">
              Meet Date
              <div className="text-white text-sm">
                {new Date((p as any).meet_date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>
        )}

        {p && (
          <ProgramLogger
            programId={p.id}
            days={flat}
            defaultIndex={completedCount % (flat.length || 1)}
            recentLogs={logs}
            trainingMaxes={trainingMaxes}
          />
        )}
      </main>
    </div>
  );
}
