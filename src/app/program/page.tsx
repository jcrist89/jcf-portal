import { requireUser } from "@/lib/auth/require";
import { supabaseForRequest } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ClientNav } from "@/components/ClientNav";
import { flattenProgram } from "@/lib/program";
import type { Program, WorkoutLog } from "@/lib/types";
import { ProgramLogger } from "@/components/ProgramLogger";

export default async function ProgramPage() {
  const user = await requireUser("client");
  const ctx = await supabaseForRequest();
  if (!ctx) redirect("/login");
  const { client } = ctx;

  const { data: profile } = await client.from("profiles").select("*").eq("id", user.id).single();
  if (!profile?.onboarded) redirect("/onboarding");

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
      <ClientNav />
      <main className="px-4 pt-6 max-w-2xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-1">
          <h1 className="font-display text-2xl uppercase tracking-wide">My Program</h1>
          {p && user.tier !== "free" && (
            <Link
              href="/program/edit"
              className="text-jcf-gold text-xs uppercase tracking-widest hover:underline shrink-0 mt-1"
            >
              Edit Program →
            </Link>
          )}
        </div>
        {p ? (
          <p className="text-jcf-gray text-sm mb-2">{p.name} — {p.description}</p>
        ) : (
          <p className="text-jcf-gray text-sm mb-6">No program assigned yet.</p>
        )}
        {p && user.tier === "free" && (
          <p className="text-jcf-gray text-xs mb-6">
            You&apos;re on the free plan — this program is read-only.{" "}
            <Link href="/pricing" className="text-jcf-gold hover:underline">
              Upgrade to customize it.
            </Link>
          </p>
        )}

        {p && (
          <ProgramLogger
            programId={p.id}
            days={flat}
            defaultIndex={completedCount % (flat.length || 1)}
            recentLogs={logs}
          />
        )}
      </main>
    </div>
  );
}
