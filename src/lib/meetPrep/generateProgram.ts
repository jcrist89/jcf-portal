import type { Exercise, ProgramDay, ProgramStructure, ProgramWeek } from "../types";
import { calculateTrainingMax } from "../trainingMax";

export interface MeetPrepWeakness {
  bench: string[];
  deadlift: string[];
}

export interface MeetPrepGeneratorInput {
  /** ISO date the program starts. */
  startDate: string;
  /** ISO date of the competition. */
  meetDate: string;
  oneRepMax: { bench: number; deadlift: number };
  weaknesses: MeetPrepWeakness;
  /** Free-text limitations to fold into coaching notes (e.g. "occasional shoulder pain"). */
  injuryNotes?: string;
}

interface WeekPlan {
  week: number;
  phaseLabel: string;
  /** Top single, as % of 1RM (not TM) — null means no top single this week (taper). */
  topSinglePercent: number | null;
  targetRpe: string;
  rpeCap: number;
  /** Ramp/wave sets leading into (and including) the day's main work set. */
  wave: { percent: number; reps: string }[];
  accessorySets: number;
  includeSecondaryDays: boolean;
  note: string;
}

// 13-week phase table: Accumulation (1-4) -> Intensification (5-8) -> Peak (9-11)
// -> Opener Practice (12) -> Taper (13). Percentages are of the athlete's entered 1RM.
const WEEK_PLAN: WeekPlan[] = [
  { week: 1, phaseLabel: "Accumulation", topSinglePercent: 80, targetRpe: "6.5-7", rpeCap: 7.5,
    wave: [{ percent: 65, reps: "5" }, { percent: 75, reps: "5" }, { percent: 85, reps: "5" }],
    accessorySets: 3, includeSecondaryDays: true, note: "Accumulation — build volume and technical consistency. Controlled top single only, no grinding." },
  { week: 2, phaseLabel: "Accumulation", topSinglePercent: 82, targetRpe: "7-7.5", rpeCap: 7.5,
    wave: [{ percent: 70, reps: "3" }, { percent: 80, reps: "3" }, { percent: 90, reps: "3" }],
    accessorySets: 3, includeSecondaryDays: true, note: "Accumulation — 3s wave. No missed reps." },
  { week: 3, phaseLabel: "Accumulation", topSinglePercent: 85, targetRpe: "7-7.5", rpeCap: 7.5,
    wave: [{ percent: 75, reps: "5" }, { percent: 85, reps: "3" }, { percent: 90, reps: "2" }],
    accessorySets: 3, includeSecondaryDays: true, note: "Accumulation — 5/3/1-style wave, capped well short of a real max." },
  { week: 4, phaseLabel: "Accumulation Deload", topSinglePercent: 70, targetRpe: "6-6.5", rpeCap: 7,
    wave: [{ percent: 60, reps: "5" }, { percent: 65, reps: "5" }, { percent: 70, reps: "5" }],
    accessorySets: 2, includeSecondaryDays: true, note: "Deload — reduced volume and intensity. Recover before Intensification." },
  { week: 5, phaseLabel: "Intensification", topSinglePercent: 85, targetRpe: "7.5-8", rpeCap: 8,
    wave: [{ percent: 75, reps: "5" }, { percent: 82, reps: "4" }, { percent: 88, reps: "3" }],
    accessorySets: 3, includeSecondaryDays: true, note: "Intensification — competition pause/setup required on every rep." },
  { week: 6, phaseLabel: "Intensification", topSinglePercent: 87, targetRpe: "7.5-8", rpeCap: 8,
    wave: [{ percent: 77, reps: "4" }, { percent: 84, reps: "3" }, { percent: 89, reps: "3" }],
    accessorySets: 3, includeSecondaryDays: true, note: "Intensification — hold competition standards on every working set." },
  { week: 7, phaseLabel: "Intensification", topSinglePercent: 89, targetRpe: "7.5-8", rpeCap: 8,
    wave: [{ percent: 78, reps: "3" }, { percent: 85, reps: "3" }, { percent: 90, reps: "2" }],
    accessorySets: 2, includeSecondaryDays: true, note: "Intensification — accessory volume trimmed to protect recovery." },
  { week: 8, phaseLabel: "Intensification Deload", topSinglePercent: 80, targetRpe: "7-7.5", rpeCap: 7.5,
    wave: [{ percent: 65, reps: "3" }, { percent: 72, reps: "3" }, { percent: 78, reps: "3" }],
    accessorySets: 2, includeSecondaryDays: true, note: "Deload before the peak block." },
  { week: 9, phaseLabel: "Meet-Specific Peak", topSinglePercent: 86, targetRpe: "8", rpeCap: 8.5,
    wave: [{ percent: 70, reps: "3" }, { percent: 78, reps: "2" }],
    accessorySets: 2, includeSecondaryDays: true, note: "Peak week 1 — full competition commands on the top single." },
  { week: 10, phaseLabel: "Meet-Specific Peak", topSinglePercent: 89, targetRpe: "8", rpeCap: 8.5,
    wave: [{ percent: 72, reps: "2" }, { percent: 80, reps: "2" }],
    accessorySets: 2, includeSecondaryDays: true, note: "Peak week 2 — only progress if the prior single was clean and within RPE." },
  { week: 11, phaseLabel: "Meet-Specific Peak", topSinglePercent: 91, targetRpe: "8-8.5", rpeCap: 8.5,
    wave: [{ percent: 75, reps: "2" }],
    accessorySets: 1, includeSecondaryDays: true, note: "Peak week 3 — heaviest single before openers. Minimal backoff." },
  { week: 12, phaseLabel: "Opener Practice", topSinglePercent: 90, targetRpe: "7.5-8", rpeCap: 8,
    wave: [],
    accessorySets: 1, includeSecondaryDays: false, note: "Opener practice — one clean single at planned-opener weight, full commands, then done." },
  { week: 13, phaseLabel: "Competition Taper", topSinglePercent: null, targetRpe: "n/a", rpeCap: 6,
    wave: [{ percent: 50, reps: "3" }],
    accessorySets: 0, includeSecondaryDays: false, note: "Taper — technique only. No heavy singles, no soreness-inducing work. Meet is this week." },
];

const BENCH_UPPER_BACK = ["Barbell Row", "Chest-Supported Row", "Face Pull"];
const BENCH_TRICEPS = ["Close-Grip Bench Press", "Triceps Pushdown", "Overhead Triceps Extension", "JM Press"];
const BENCH_SHOULDER = ["Landmine Press", "Cable External Rotation", "Serratus Wall Slide", "Band Pull-Apart"];
const BENCH_VARIATION = ["Close-Grip Bench Press", "Spoto Press", "Floor Press", "Board Press"];
const ROW_PULLDOWN = ["Lat Pulldown", "Chest-Supported Row", "Seated Cable Row"];

const DL_VARIATION = ["Paused Deadlift (Below Knee)", "Deficit Deadlift", "Tempo Deadlift (3ct Down)"];
const DL_HAMSTRING = ["Romanian Deadlift", "Seated Leg Curl", "Lying Leg Curl"];
const DL_GLUTE = ["Barbell Hip Thrust", "Cable Pull-Through", "Glute Bridge"];
const DL_HIP_STABILITY = ["Front Squat", "Copenhagen Plank", "Banded Lateral Walk"];
const DL_LOWER_BACK = ["45-Degree Back Extension", "Good Morning", "Bird Dog"];

function pick<T>(pool: T[], index: number): T {
  return pool[index % pool.length];
}

// WEEK_PLAN percentages are authored as % of the athlete's true 1RM (matching how a
// coach actually talks about opener/peak weights), but the app's existing resolution
// pipeline (workingWeight, ProgramLogger) only understands "% of Training Max" via
// Exercise.percentOfTm. Convert once here rather than teaching the resolver a second
// basis — TM is a fixed 90% of 1RM, so % of 1RM => % of TM is a straight division.
const TM_PERCENT = 90;
function toPercentOfTm(percentOf1Rm: number): number {
  return Math.round((percentOf1Rm / TM_PERCENT) * 1000) / 10;
}

function accessory(name: string, sets: number, reps: string, notes?: string): Exercise | null {
  if (sets <= 0) return null;
  return { name, sets, reps, rest: "60-90 sec", notes };
}

function buildWaveNotes(wave: { percent: number; reps: string }[]): string {
  if (wave.length === 0) return "";
  return `Ramp: ${wave.map((s) => `${s.percent}%x${s.reps}`).join(", ")}.`;
}

function buildMainDay(
  plan: WeekPlan,
  lift: "bench" | "deadlift",
  shoulderCaution: boolean,
  weekIdx: number,
): Exercise[] {
  const liftKey = lift === "bench" ? "meet_bench" : "meet_deadlift";
  const liftName = lift === "bench" ? "Competition Bench Press" : "Competition Deadlift";
  const exercises: Exercise[] = [];

  if (plan.topSinglePercent != null) {
    exercises.push({
      name: `${liftName} — Top Single`,
      sets: 1,
      reps: "1",
      rest: "3-5 min",
      liftKey,
      percentOfTm: toPercentOfTm(plan.topSinglePercent),
      targetRpe: plan.targetRpe,
      rpeCap: plan.rpeCap,
      unit: "kg",
      notes: plan.note,
    });
  } else {
    exercises.push({
      name: `${liftName} — Technique Only`,
      sets: 2,
      reps: "3",
      rest: "2 min",
      unit: "kg",
      notes: `${plan.note} Light, technical, well short of any grind.`,
    });
  }

  if (plan.wave.length > 0) {
    const topWaveSet = plan.wave[plan.wave.length - 1];
    exercises.push({
      name: `${liftName} — Wave Work`,
      sets: plan.wave.length,
      reps: topWaveSet.reps,
      rest: "2-3 min",
      liftKey,
      percentOfTm: toPercentOfTm(topWaveSet.percent),
      unit: "kg",
      notes: buildWaveNotes(plan.wave),
    });
  }

  if (lift === "bench") {
    exercises.push(
      accessory(pick(BENCH_TRICEPS, weekIdx), plan.accessorySets, "6-10")!,
      accessory(pick(BENCH_UPPER_BACK, weekIdx), plan.accessorySets, "8-12")!,
      accessory(
        pick(BENCH_SHOULDER, weekIdx),
        plan.accessorySets,
        "10-15",
        shoulderCaution ? "Moderate volume — back off if shoulder is symptomatic." : undefined,
      )!,
    );
  } else {
    exercises.push(
      accessory(pick(DL_HAMSTRING, weekIdx), plan.accessorySets, "6-10")!,
      accessory(pick(DL_GLUTE, weekIdx), plan.accessorySets, "8-12")!,
      accessory(pick(DL_LOWER_BACK, weekIdx), plan.accessorySets, "8-12")!,
    );
  }

  return exercises.filter((e): e is Exercise => e != null);
}

function buildSecondaryBenchDay(plan: WeekPlan, weekIdx: number, shoulderCaution: boolean): Exercise[] {
  const sets = Math.max(plan.accessorySets, 2);
  return [
    { name: pick(BENCH_VARIATION, weekIdx), sets, reps: "5-8", rest: "2 min", notes: "Submaximal — not TM-tracked, log by feel around RPE 7-8." },
    accessory(pick(ROW_PULLDOWN, weekIdx), sets, "8-12")!,
    accessory(pick(BENCH_TRICEPS, weekIdx + 1), plan.accessorySets, "8-12")!,
    accessory(
      pick(BENCH_SHOULDER, weekIdx + 1),
      plan.accessorySets,
      "10-15",
      shoulderCaution ? "Keep this light and controlled." : undefined,
    )!,
  ].filter((e): e is Exercise => e != null);
}

function buildSecondaryDeadliftDay(plan: WeekPlan, weekIdx: number): Exercise[] {
  const sets = Math.max(plan.accessorySets, 2);
  return [
    { name: pick(DL_VARIATION, weekIdx), sets, reps: "4-6", rest: "2 min", notes: "Submaximal — not TM-tracked, target the below-the-knee position specifically." },
    accessory(pick(DL_HAMSTRING, weekIdx + 1), plan.accessorySets, "8-12")!,
    accessory(pick(DL_GLUTE, weekIdx + 1), plan.accessorySets, "8-12")!,
    accessory(pick(DL_HIP_STABILITY, weekIdx), plan.accessorySets, "8-12", "Includes Front Squat as posterior-chain/quad maintenance."),
  ].filter((e): e is Exercise => e != null);
}

export function generateMeetPrepProgram(input: MeetPrepGeneratorInput): ProgramStructure {
  const shoulderCaution = /shoulder/i.test(input.injuryNotes ?? "");
  const weeks: ProgramWeek[] = WEEK_PLAN.map((plan, weekIdx) => {
    const days: ProgramDay[] = [
      { day: 1, label: `Day 1 — Competition Bench (${plan.phaseLabel})`, exercises: buildMainDay(plan, "bench", shoulderCaution, weekIdx) },
      { day: 2, label: `Day 2 — Competition Deadlift (${plan.phaseLabel})`, exercises: buildMainDay(plan, "deadlift", false, weekIdx) },
    ];

    if (plan.includeSecondaryDays) {
      days.push(
        { day: 3, label: `Day 3 — Secondary Bench (${plan.phaseLabel})`, exercises: buildSecondaryBenchDay(plan, weekIdx, shoulderCaution) },
        { day: 4, label: `Day 4 — Secondary Deadlift / Posterior Chain (${plan.phaseLabel})`, exercises: buildSecondaryDeadliftDay(plan, weekIdx) },
      );
    } else if (plan.week === 12) {
      days.push(
        { day: 3, label: "Day 3 — Light Technique", exercises: [
          { name: "Competition Bench Press — Technique", sets: 2, reps: "3", rest: "2 min", unit: "kg", notes: "Light, 60-65%. Groove the setup, nothing taxing." },
        ] },
        { day: 4, label: "Day 4 — Rest / Mobility", exercises: [
          { name: "Mobility & Recovery", sets: 1, reps: "10-15 min", rest: "n/a", notes: "Light mobility work only. Save it for the meet." },
        ] },
      );
    } else {
      days.push(
        { day: 3, label: "Day 3 — Rest", exercises: [{ name: "Rest / Travel", sets: 1, reps: "n/a", rest: "n/a", notes: "Meet week — no training." }] },
        { day: 4, label: "Day 4 — Rest (Meet Day Saturday)", exercises: [{ name: "Competition Day", sets: 1, reps: "n/a", rest: "n/a", notes: "Bench & Deadlift meet — good luck." }] },
      );
    }

    return { week: plan.week, note: plan.note, days };
  });

  return { weeks };
}

// Phase label for a given program week, keyed off the same WEEK_PLAN the generator
// itself uses — so joker eligibility / compliance never duplicate this table.
export function phaseForWeek(week: number): string | null {
  return WEEK_PLAN.find((p) => p.week === week)?.phaseLabel ?? null;
}

export function projectedTrainingMaxes(oneRepMax: { bench: number; deadlift: number }) {
  return {
    bench: calculateTrainingMax(oneRepMax.bench),
    deadlift: calculateTrainingMax(oneRepMax.deadlift),
  };
}
