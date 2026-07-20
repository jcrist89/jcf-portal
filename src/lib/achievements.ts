import { differenceInCalendarDays, differenceInCalendarWeeks, parseISO } from "date-fns";
import type {
  Achievement,
  AchievementType,
  Measurement,
  Profile,
  PR,
  WorkoutLog,
} from "@/lib/types";

/**
 * Achievement rules engine.
 *
 * Each rule is a small, independently-testable function: given the client's
 * current data, decide whether a new badge should be awarded. `runAchievementChecks`
 * fans out to all of them and returns only the badges not already earned, so it's
 * safe to call after every workout log, measurement, or PR without worrying about
 * duplicates.
 */

export interface AchievementContext {
  profile: Profile;
  existing: Achievement[];
  workoutLogs: WorkoutLog[]; // all logs for this profile, most recent first is fine
  measurements: Measurement[];
  prs: PR[];
}

export interface NewAchievement {
  type: AchievementType | string;
  title: string;
  description: string;
  icon: string;
}

function already(ctx: AchievementContext, type: string): boolean {
  return ctx.existing.some((a) => a.type === type);
}

export function checkFirstWorkout(ctx: AchievementContext): NewAchievement[] {
  const completed = ctx.workoutLogs.filter((w) => w.completed);
  if (completed.length >= 1 && !already(ctx, "first_workout")) {
    return [
      {
        type: "first_workout",
        title: "First Rep Logged",
        description: "You logged your first completed workout. Consistency starts now.",
        icon: "flag",
      },
    ];
  }
  return [];
}

export function checkWorkoutMilestones(ctx: AchievementContext): NewAchievement[] {
  const count = ctx.workoutLogs.filter((w) => w.completed).length;
  const milestones: Array<{ n: number; type: string; title: string }> = [
    { n: 10, type: "workouts_10", title: "10 Workouts Logged" },
    { n: 25, type: "workouts_25", title: "25 Workouts Logged" },
    { n: 50, type: "workouts_50", title: "50 Workouts Logged" },
  ];
  const out: NewAchievement[] = [];
  for (const m of milestones) {
    if (count >= m.n && !already(ctx, m.type)) {
      out.push({
        type: m.type,
        title: m.title,
        description: `You've logged ${m.n} completed workouts. Keep stacking days.`,
        icon: "dumbbell",
      });
    }
  }
  return out;
}

/** Consecutive-week logging streaks — a week "counts" if it has >=1 completed workout. */
export function checkStreaks(ctx: AchievementContext): NewAchievement[] {
  const dates = ctx.workoutLogs
    .filter((w) => w.completed)
    .map((w) => parseISO(w.date))
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 0) return [];

  const weekSet = new Set(
    dates.map((d) => differenceInCalendarWeeks(d, dates[0], { weekStartsOn: 1 }))
  );
  // longest run of consecutive week indices
  const weeks = Array.from(weekSet).sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < weeks.length; i++) {
    if (weeks[i] === weeks[i - 1] + 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  const out: NewAchievement[] = [];
  if (longest >= 4 && !already(ctx, "streak_4_weeks")) {
    out.push({
      type: "streak_4_weeks",
      title: "4-Week Streak",
      description: "Four straight weeks with a logged workout. That's a habit.",
      icon: "flame",
    });
  }
  if (longest >= 8 && !already(ctx, "streak_8_weeks")) {
    out.push({
      type: "streak_8_weeks",
      title: "8-Week Streak",
      description: "Eight straight weeks of consistent training.",
      icon: "flame",
    });
  }
  return out;
}

/** Call right after inserting a new PR row — awards `pr_hit` if it beats the prior best for that lift. */
export function checkPrHit(ctx: AchievementContext, newPr: PR): NewAchievement[] {
  const priorBestForLift = ctx.prs
    .filter((p) => p.lift === newPr.lift && p.id !== newPr.id)
    .reduce((max, p) => Math.max(max, p.weight), 0);

  if (newPr.weight > priorBestForLift) {
    return [
      {
        type: "pr_hit",
        title: `New PR — ${formatLift(newPr.lift)}`,
        description: `${newPr.weight} lb x ${newPr.reps} on ${formatLift(newPr.lift)}. New best.`,
        icon: "trophy",
      },
    ];
  }
  return [];
}

function formatLift(lift: string): string {
  return lift
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** First measurement check-in that lands >=30 days after the first-ever check-in. */
export function checkFirstCheckinAfter30Days(ctx: AchievementContext): NewAchievement[] {
  if (already(ctx, "first_checkin_30_days")) return [];
  if (ctx.measurements.length < 2) return [];
  const sorted = [...ctx.measurements].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  if (differenceInCalendarDays(parseISO(latest.date), parseISO(first.date)) >= 30) {
    return [
      {
        type: "first_checkin_30_days",
        title: "30-Day Check-In",
        description: "You've been tracking progress for 30+ days. That's how change happens.",
        icon: "calendar",
      },
    ];
  }
  return [];
}

/** Goal-specific milestone — thresholds are placeholders Jon can tune later. */
export function checkGoalMilestone(ctx: AchievementContext): NewAchievement[] {
  if (already(ctx, "goal_milestone")) return [];
  const { profile, prs, workoutLogs } = ctx;

  if (profile.goal === "fat_loss") {
    if (
      profile.starting_weight &&
      profile.current_weight &&
      profile.starting_weight - profile.current_weight >= 10
    ) {
      return [goalMilestone("Down 10 lb from your starting weight. Great work.")];
    }
  }

  if (profile.goal === "powerlifting") {
    const best = (lift: string) =>
      prs.filter((p) => p.lift === lift).reduce((m, p) => Math.max(m, p.weight), 0);
    const total = best("squat") + best("bench") + best("deadlift");
    if (total >= 1000) {
      return [goalMilestone(`${total} lb combined squat/bench/deadlift total. Big milestone.`)];
    }
  }

  if (profile.goal === "strength_gain") {
    const bw = profile.current_weight ?? profile.starting_weight ?? 0;
    const bestAny = prs.reduce((m, p) => Math.max(m, p.weight), 0);
    if (bw > 0 && bestAny >= bw * 1.5) {
      return [goalMilestone("Hit a lift at 1.5x bodyweight. Strength is trending up.")];
    }
  }

  if (profile.goal === "hybrid") {
    const count = workoutLogs.filter((w) => w.completed).length;
    if (count >= 15) {
      return [goalMilestone("15 workouts in on your hybrid program. Steady progress.")];
    }
  }

  return [];
}

function goalMilestone(description: string): NewAchievement {
  return { type: "goal_milestone", title: "Goal Milestone", description, icon: "target" };
}

export function runAchievementChecks(
  ctx: AchievementContext,
  opts: { newPr?: PR } = {}
): NewAchievement[] {
  const results = [
    ...checkFirstWorkout(ctx),
    ...checkWorkoutMilestones(ctx),
    ...checkStreaks(ctx),
    ...(opts.newPr ? checkPrHit(ctx, opts.newPr) : []),
    ...checkFirstCheckinAfter30Days(ctx),
    ...checkGoalMilestone(ctx),
  ];
  // de-dupe by type in case two rules somehow collide in one pass
  const seen = new Set<string>();
  return results.filter((r) => (seen.has(r.type) ? false : (seen.add(r.type), true)));
}

export interface CatalogEntry {
  type: string;
  title: string;
  description: string;
  icon: string;
}

/** Static catalog used by the badges screen to show locked/earned state for every badge. */
export const ACHIEVEMENT_CATALOG: CatalogEntry[] = [
  { type: "first_workout", title: "First Rep Logged", description: "Log your first completed workout.", icon: "flag" },
  { type: "streak_4_weeks", title: "4-Week Streak", description: "Log a workout for 4 consecutive weeks.", icon: "flame" },
  { type: "streak_8_weeks", title: "8-Week Streak", description: "Log a workout for 8 consecutive weeks.", icon: "flame" },
  { type: "workouts_10", title: "10 Workouts Logged", description: "Complete 10 total workouts.", icon: "dumbbell" },
  { type: "workouts_25", title: "25 Workouts Logged", description: "Complete 25 total workouts.", icon: "dumbbell" },
  { type: "workouts_50", title: "50 Workouts Logged", description: "Complete 50 total workouts.", icon: "dumbbell" },
  { type: "pr_hit", title: "New PR", description: "Beat your previous best on any lift.", icon: "trophy" },
  { type: "first_checkin_30_days", title: "30-Day Check-In", description: "Log measurements 30+ days apart.", icon: "calendar" },
  { type: "goal_milestone", title: "Goal Milestone", description: "Hit a milestone tied to your specific goal.", icon: "target" },
];
