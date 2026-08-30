import { requireUser } from "@/lib/auth/require";
import Link from "next/link";
import { ClientNav } from "@/components/ClientNav";
import { flattenProgram } from "@/lib/program";
import { schedulePosition } from "@/domain/schedule";
import { loadSchedule } from "@/server/schedule";
import type { JokerRequest, Program, ReadinessCheckin, WorkoutLog, TrainingMax } from "@/lib/types";
import { ProgramLogger } from "@/components/ProgramLogger";
import { kgToLb } from "@/lib/meetPrep/attemptPlanner";
import { trainingDateIn } from "@/lib/localDate";

export default async function ProgramPage() {
  const { client, session: user, profile } = await requireUser("client");

  // The client's training day, not the server's UTC day — a 01:30 session in
  // Toronto is 05:30 UTC, which used to file it under tomorrow.
  const today = trainingDateIn(profile.timezone);

  const [{ data: program }, { data: workoutLogs }, { data: trainingMaxRows }, { data: todayReadinessRow }, { data: jokerRequestRows }, schedule] =
    await Promise.all([
      profile.program_id
        ? client.from("programs").select("*").eq("id", profile.program_id).maybeSingle()
        : Promise.resolve({ data: null }),
      client.from("workout_logs").select("*").eq("profile_id", user.id).order("date", { ascending: false }),
      client.from("training_maxes").select("*").eq("profile_id", user.id),
      client.from("readiness_checkins").select("*").eq("profile_id", user.id).eq("date", today).maybeSingle(),
      client.from("joker_requests").select("*").eq("profile_id", user.id),
      loadSchedule(client, user.id),
    ]);

  const p = program as Program | null;
  const flat = flattenProgram(p);
  const logs = (workoutLogs ?? []) as WorkoutLog[];

  // The schedule decides which session; the program structure still supplies what is in
  // it. Two different facts, so this is one source of truth for each rather than two for
  // the same one.
  const position = schedulePosition(schedule.assignment, schedule.sessions, today);
  const scheduledIndex = position.session
    ? flat.findIndex(
        (d) => d.week === position.session!.week_number && d.day === position.session!.day_number,
      )
    : -1;

  const trainingMaxes: Record<string, number> = {};
  for (const row of (trainingMaxRows ?? []) as TrainingMax[]) {
    trainingMaxes[row.lift] = Number(row.weight);
  }

  const daysToMeet =
    p && p.meet_date
      ? Math.ceil((new Date(p.meet_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

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

        {p && p.meet_date && daysToMeet != null && (
          <div className="bg-jcf-panel border border-white/10 rounded-sm p-4 mb-6 flex items-center justify-between">
            <div>
              <div className="font-display text-3xl text-white">{daysToMeet}</div>
              <div className="text-[10px] uppercase tracking-wider text-jcf-gray">Days to Platform</div>
            </div>
            <div className="text-right text-xs text-jcf-gray">
              Meet Date
              <div className="text-white text-sm">
                {new Date(p.meet_date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>
        )}

        {p && p.attempt_plan?.released && (
          <div className="bg-jcf-panel border border-jcf-gold/30 rounded-sm p-4 mb-6">
            <h2 className="font-display uppercase tracking-wide text-sm text-jcf-gold mb-3">Your Openers</h2>
            <div className="grid grid-cols-2 gap-4">
              {(["bench", "deadlift"] as const).map((lift) => {
                const entry = p.attempt_plan![lift];
                return (
                  <div key={lift}>
                    <div className="text-xs uppercase tracking-widest text-jcf-gray mb-1">{lift}</div>
                    {(["opener", "second", "third"] as const).map((field) => (
                      <div key={field} className="text-sm text-white flex justify-between">
                        <span className="text-jcf-gray capitalize">{field}</span>
                        <span>
                          {entry[field] != null ? `${entry[field]}kg / ${kgToLb(entry[field] as number)}lb` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {p && (
          <ProgramLogger
            programId={p.id}
            days={flat}
            defaultIndex={scheduledIndex >= 0 ? scheduledIndex : Math.max(0, flat.length - 1)}
            assignmentSessionId={position.session?.id ?? null}
            recentLogs={logs}
            trainingMaxes={trainingMaxes}
            profileId={user.id}
            initialReadiness={(todayReadinessRow as ReadinessCheckin | null) ?? null}
            initialJokerRequests={(jokerRequestRows ?? []) as JokerRequest[]}
          />
        )}
      </main>
    </div>
  );
}
