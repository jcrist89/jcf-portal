import type { SupabaseClient } from "@supabase/supabase-js";
import { differenceInCalendarWeeks, parseISO, startOfWeek, isAfter, isEqual } from "date-fns";
import type { Profile, Program, WorkoutLog, Measurement, PR } from "@/lib/types";

export interface ClientSummary {
  profile: Profile;
  program: Program | null;
  totalWorkouts: number;
  workoutsThisWeek: number;
  plannedPerWeek: number;
  streak: number;
  lastActivity: string | null;
}

export async function computeClientSummary(
  supabase: SupabaseClient,
  profileId: string
): Promise<ClientSummary | null> {
  const [{ data: profile }, { data: logs }, { data: measurements }, { data: prs }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", profileId).maybeSingle(),
    supabase.from("workout_logs").select("*").eq("profile_id", profileId),
    supabase.from("measurements").select("date").eq("profile_id", profileId),
    supabase.from("prs").select("date").eq("profile_id", profileId),
  ]);
  if (!profile) return null;

  let program: Program | null = null;
  if (profile.program_id) {
    const { data } = await supabase.from("programs").select("*").eq("id", profile.program_id).maybeSingle();
    program = (data as Program) ?? null;
  }

  return buildSummary(profile as Profile, program, (logs ?? []) as WorkoutLog[], measurements ?? [], prs ?? []);
}

export function buildSummary(
  profile: Profile,
  program: Program | null,
  logs: WorkoutLog[],
  measurements: { date: string }[],
  prs: { date: string }[]
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
