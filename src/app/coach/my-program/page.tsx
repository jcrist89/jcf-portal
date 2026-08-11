import { requireUser } from "@/lib/auth/require";
import Link from "next/link";
import { CoachNav } from "@/components/CoachNav";
import { flattenProgram } from "@/lib/program";
import type { Program, WorkoutLog } from "@/lib/types";
import { ProgramLogger } from "@/components/ProgramLogger";

/**
 * Coach's own workout log/program page — same ProgramLogger component the
 * client-facing /program page uses, but scoped to the coach's own profile so
 * Jon can track his own training without a second, client-role login.
 * No training maxes / readiness / joker-request / meet-date features here —
 * this is a plain hypertrophy program, not a meet-prep block.
 */
export default async function CoachMyProgramPage() {
  const { client, session: user, profile } = await requireUser("coach");

  const [{ data: program }, { data: workoutLogs }] = await Promise.all([
    profile.program_id
      ? client.from("programs").select("*").eq("id", profile.program_id).maybeSingle()
      : Promise.resolve({ data: null }),
    client.from("workout_logs").select("*").eq("profile_id", user.id).order("date", { ascending: false }),
  ]);

  const p = program as Program | null;
  const flat = flattenProgram(p);
  const logs = (workoutLogs ?? []) as WorkoutLog[];
  const completedCount = logs.filter((l) => l.completed).length;

  return (
    <div className="pb-24">
      <CoachNav />
      <main className="px-4 pt-6 max-w-2xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-1">
          <h1 className="font-display text-2xl uppercase tracking-wide">My Training</h1>
          <div className="flex flex-col items-end gap-1 shrink-0 mt-1">
            {p && (
              <Link href="/coach/my-program/edit" className="text-jcf-gold text-xs uppercase tracking-widest hover:underline">
                Edit Program →
              </Link>
            )}
            <Link href="/coach/my-progress" className="text-jcf-gray text-xs uppercase tracking-widest hover:text-jcf-gold hover:underline">
              Progress →
            </Link>
          </div>
        </div>
        {p ? (
          <p className="text-jcf-gray text-sm mb-6">{p.name} — {p.description}</p>
        ) : (
          <p className="text-jcf-gray text-sm mb-6">No program assigned yet.</p>
        )}

        {p && (
          <ProgramLogger
            programId={p.id}
            days={flat}
            defaultIndex={completedCount % (flat.length || 1)}
            recentLogs={logs}
            profileId={user.id}
          />
        )}
      </main>
    </div>
  );
}
