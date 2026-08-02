import type { SupabaseClient } from "@supabase/supabase-js";
import { differenceInCalendarWeeks, parseISO, startOfWeek, isAfter, isEqual } from "date-fns";
import type {
  DeviationReport,
  JokerRequest,
  Profile,
  Program,
  ReadinessCheckin,
  ReadinessTier,
  TrainingMax,
  WorkoutLog,
} from "@/lib/types";
import { flattenProgram } from "@/lib/program";
import { computeWeeklyCompliance } from "@/lib/meetPrep/compliance";

export interface MeetPrepAlert {
  pendingJokers: number;
  readinessTier: ReadinessTier | null;
  complianceScore: number | null;
  complianceCategory: string | null;
}

export interface MeetPrepData {
  trainingMaxes: TrainingMax[];
  jokerRequests: JokerRequest[];
  readiness: ReadinessCheckin[];
  deviations: DeviationReport[];
}

export interface ClientSummary {
  profile: Profile;
  program: Program | null;
  totalWorkouts: number;
  workoutsThisWeek: number;
  plannedPerWeek: number;
  streak: number;
  lastActivity: string | null;
  meetPrepAlert: MeetPrepAlert | null;
}

export async function computeClientSummary(
  supabase: SupabaseClient,
  profileId: string
): Promise<ClientSummary | null> {
  const [
    { data: profile },
    { data: logs },
    { data: measurements },
    { data: prs },
    { data: trainingMaxes },
    { data: jokerRequests },
    { data: readiness },
    { data: deviations },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", profileId).maybeSingle(),
    supabase.from("workout_logs").select("*").eq("profile_id", profileId),
    supabase.from("measurements").select("date").eq("profile_id", profileId),
    supabase.from("prs").select("date").eq("profile_id", profileId),
    supabase.from("training_maxes").select("*").eq("profile_id", profileId),
    supabase.from("joker_requests").select("*").eq("profile_id", profileId),
    supabase.from("readiness_checkins").select("*").eq("profile_id", profileId),
    supabase.from("deviation_reports").select("*").eq("profile_id", profileId),
  ]);
  if (!profile) return null;

  let program: Program | null = null;
  if (profile.program_id) {
    const { data } = await supabase.from("programs").select("*").eq("id", profile.program_id).maybeSingle();
    program = (data as Program) ?? null;
  }

  return buildSummary(profile as Profile, program, (logs ?? []) as WorkoutLog[], measurements ?? [], prs ?? [], {
    trainingMaxes: (trainingMaxes ?? []) as TrainingMax[],
    jokerRequests: (jokerRequests ?? []) as JokerRequest[],
    readiness: (readiness ?? []) as ReadinessCheckin[],
    deviations: (deviations ?? []) as DeviationReport[],
  });
}

export function buildSummary(
  profile: Profile,
  program: Program | null,
  logs: WorkoutLog[],
  measurements: { date: string }[],
  prs: { date: string }[],
  meetPrepData?: MeetPrepData
): ClientSummary {
  const completed = logs.filter((l) => l.completed);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const workoutsThisWeek = completed.filter((l) => {
    const d = parseISO(l.date);
    return isAfter(d, weekStart) || isEqual(d, weekStart);
  }).length;

  const plannedPerWeek = program?.structure?.weeks?.[0]?.days?.length ?? 0;

  const dates = [
    ...completed.map((l) => l.date),
    ...measurements.map((m) => m.date),
    ...prs.map((p) => p.date),
  ].sort();
  const lastActivity = dates.length ? dates[dates.length - 1] : null;

  const streak = computeStreak(completed.map((l) => l.date));

  return {
    profile,
    program,
    totalWorkouts: completed.length,
    workoutsThisWeek,
    plannedPerWeek,
    streak,
    lastActivity,
    meetPrepAlert: meetPrepData ? computeMeetPrepAlert(program, logs, meetPrepData) : null,
  };
}

function computeMeetPrepAlert(program: Program | null, logs: WorkoutLog[], data: MeetPrepData): MeetPrepAlert | null {
  const isMeetPrep = data.trainingMaxes.some((t) => t.lift === "meet_bench" || t.lift === "meet_deadlift");
  if (!isMeetPrep) return null;

  const pendingJokers = data.jokerRequests.filter((j) => j.status === "pending").length;

  const today = new Date().toISOString().slice(0, 10);
  const todayReadiness = data.readiness.find((r) => r.date === today);

  const flat = flattenProgram(program);
  const completedCount = logs.filter((l) => l.completed).length;
  const currentWeek = flat.length ? flat[completedCount % flat.length].week : 1;
  const compliance = computeWeeklyCompliance({
    program,
    logs,
    deviations: data.deviations,
    readiness: data.readiness,
    week: currentWeek,
  });

  return {
    pendingJokers,
    readinessTier: todayReadiness?.tier ?? null,
    complianceScore: compliance.score,
    complianceCategory: compliance.category,
  };
}

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = dates.map((d) => parseISO(d)).sort((a, b) => a.getTime() - b.getTime());
  const weeks = Array.from(
    new Set(sorted.map((d) => differenceInCalendarWeeks(d, sorted[0], { weekStartsOn: 1 })))
  ).sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < weeks.length; i++) {
    if (weeks[i] === weeks[i - 1] + 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else run = 1;
  }
  return longest;
}
