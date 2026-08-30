/**
 * Session scaling. Pure — no Supabase, no Next, no React.
 *
 * Rough Shift exists for one failure mode: a bad night, a decision that the perfect
 * session is out of reach, and therefore nothing at all. It produces a legitimate
 * reduced session so the day is still a training day, and records that it happened so
 * the coach can see repeated use for what it is — a life-stress signal, not laziness.
 *
 * The governing safety rule: **Rough Shift reduces volume, never intensity by
 * arithmetic.** A blanket 40% cut is fine on an accessory day and dangerous on a
 * peaking week, so a session carrying near-maximal work is handled separately — either
 * by a variant the coach authored, or by dropping to explicit technique work at a safe
 * ceiling. It never scales a near-maximal load down by a percentage and calls it safe.
 */

export type ScalingMode = "rough_shift" | "no_equipment" | "short_on_time";

export const ROUGH_SHIFT_REASONS = [
  "bad_sleep",
  "low_energy",
  "short_time",
  "pain",
  "stressed",
] as const;
export type RoughShiftReason = (typeof ROUGH_SHIFT_REASONS)[number];

export const REASON_LABELS: Record<RoughShiftReason, string> = {
  bad_sleep: "Barely slept",
  low_energy: "No energy",
  short_time: "No time",
  pain: "Something hurts",
  stressed: "Stressed / flat",
};

/** At or above this percentage of training max, volume maths stops being safe. */
export const NEAR_MAXIMAL_PERCENT = 85;

/** The ceiling technique work drops to when a near-maximal day has no authored variant. */
export const TECHNIQUE_PERCENT = 70;

export interface ScalableExercise {
  exerciseId?: string;
  name: string;
  position: number;
  /** 1 = keep, 2 = normal, 3 = first to drop. Defaults to 2 when the coach hasn't set it. */
  priority?: number;
  sets: string | null;
  reps: string | null;
  percentOfTm?: number | null;
  liftKey?: string | null;
  /** Coach-authored Rough Shift variant. Always preferred over any rule. */
  scaledSets?: string | null;
  scaledReps?: string | null;
}

export type ScalingAction = "keep" | "reduce" | "drop" | "technique";

export interface ScaledExercise {
  source: ScalableExercise;
  action: ScalingAction;
  /** What to actually do. Null sets/reps on a dropped exercise. */
  sets: string | null;
  reps: string | null;
  /** Percentage of training max to work at — only lowered for technique work. */
  percentOfTm: number | null;
  /** Plain-language reason, shown next to the exercise. */
  note: string;
}

export interface ScalingPlan {
  mode: ScalingMode;
  reason: RoughShiftReason | null;
  exercises: ScaledExercise[];
  /** Actual reduction achieved, not a target claimed. */
  volumeReductionPct: number;
  /** The session carries near-maximal work. */
  nearMaximal: boolean;
  /** A coach-authored variant was used rather than a rule. */
  usedAuthoredVariant: boolean;
  /** Shown to the client above the session. One sentence, never apologetic. */
  summary: string;
  /** Shown when safety changed the shape of the session, rather than just its size. */
  safetyNote: string | null;
}

/** First number in a prescription. "6-10" is 6, "AMRAP" is 1, null is 1. */
export function parseCount(value: string | null | undefined): number {
  if (!value) return 1;
  const match = String(value).match(/\d+/);
  return match ? Math.max(1, parseInt(match[0], 10)) : 1;
}

function volumeOf(sets: string | null, reps: string | null): number {
  return parseCount(sets) * parseCount(reps);
}

function totalVolume(items: Array<{ sets: string | null; reps: string | null }>): number {
  return items.reduce((n, e) => n + volumeOf(e.sets, e.reps), 0);
}

/**
 * Which exercises carry the session's purpose.
 *
 * An explicit priority of 1 wins. Otherwise anything driven by a training max or tagged
 * with a lift key is the point of the session; failing that, the first exercise is.
 * Inferring this matters because priority is unset on every existing program — a rule
 * that only worked once a coach had hand-tagged 1446 exercises would never run.
 */
function primaryIndexes(exercises: ScalableExercise[]): Set<number> {
  const explicit = exercises
    .map((e, i) => (e.priority === 1 ? i : -1))
    .filter((i) => i >= 0);
  if (explicit.length > 0) return new Set(explicit);

  const driven = exercises
    .map((e, i) => (e.percentOfTm != null || e.liftKey ? i : -1))
    .filter((i) => i >= 0);
  if (driven.length > 0) return new Set(driven);

  return new Set(exercises.length > 0 ? [0] : []);
}

/**
 * Builds the reduced session.
 *
 * Three shapes, in order of precedence:
 *
 *   1. A coach authored a scaled variant for these exercises — use it verbatim. Nothing
 *      a rule can infer beats what the person writing the program decided.
 *   2. The session carries work at or above NEAR_MAXIMAL_PERCENT of training max and no
 *      variant exists — drop to technique work at TECHNIQUE_PERCENT and cut the
 *      accessories. The movement is preserved; the near-maximal load is not attempted by
 *      someone who has just said they are wrecked.
 *   3. Everything else — keep the primary movement with a set removed, take a set off
 *      each surviving accessory, and drop the lowest-priority tail.
 */
export function planRoughShift(
  exercises: ScalableExercise[],
  reason: RoughShiftReason | null = null,
): ScalingPlan {
  const ordered = [...exercises].sort((a, b) => a.position - b.position);

  if (ordered.length === 0) {
    return {
      mode: "rough_shift",
      reason,
      exercises: [],
      volumeReductionPct: 0,
      nearMaximal: false,
      usedAuthoredVariant: false,
      summary: "Nothing to scale.",
      safetyNote: null,
    };
  }

  const primaries = primaryIndexes(ordered);
  const nearMaximal = ordered.some(
    (e) => e.percentOfTm != null && e.percentOfTm >= NEAR_MAXIMAL_PERCENT,
  );
  const hasAuthored = ordered.some((e) => e.scaledSets || e.scaledReps);

  const before = totalVolume(ordered.map((e) => ({ sets: e.sets, reps: e.reps })));
  let scaled: ScaledExercise[];
  let safetyNote: string | null = null;

  if (hasAuthored) {
    scaled = ordered.map((e, i) => {
      if (e.scaledSets || e.scaledReps) {
        return {
          source: e,
          action: "reduce" as const,
          sets: e.scaledSets ?? e.sets,
          reps: e.scaledReps ?? e.reps,
          percentOfTm: e.percentOfTm ?? null,
          note: "Jon's reduced version",
        };
      }
      // Anything the coach didn't write a variant for is an accessory they were happy to
      // lose on a bad day.
      if (primaries.has(i)) {
        return {
          source: e,
          action: "keep" as const,
          sets: e.sets,
          reps: e.reps,
          percentOfTm: e.percentOfTm ?? null,
          note: "Unchanged",
        };
      }
      return { source: e, action: "drop" as const, sets: null, reps: null, percentOfTm: null, note: "Skipped today" };
    });
  } else if (nearMaximal) {
    scaled = ordered.map((e, i) => {
      if (!primaries.has(i)) {
        return { source: e, action: "drop" as const, sets: null, reps: null, percentOfTm: null, note: "Skipped today" };
      }
      const heavy = e.percentOfTm != null && e.percentOfTm >= NEAR_MAXIMAL_PERCENT;
      return {
        source: e,
        action: heavy ? ("technique" as const) : ("reduce" as const),
        sets: "2",
        reps: e.reps,
        // Lowered to an explicit safe ceiling, not reduced by a percentage of a heavy
        // load — the distinction the whole safety rule turns on.
        percentOfTm: heavy ? TECHNIQUE_PERCENT : e.percentOfTm ?? null,
        note: heavy ? `Technique work at ${TECHNIQUE_PERCENT}% — no heavy singles today` : "Lighter today",
      };
    });
    safetyNote =
      "Today had heavy work on it. Rough Shift keeps the movement but takes the load off — " +
      "grinding a near-max single on no sleep is how people get hurt.";
  } else {
    // Anything the coach tagged as first-to-drop goes, plus enough of the tail to thin
    // the session out. Dropping half the accessories AND halving the rest lands around a
    // 75% cut, which is a token session rather than a reduced one — the point is a real
    // session the client can be proud of finishing, not a participation trophy.
    const accessoryIdx = ordered.map((_, i) => i).filter((i) => !primaries.has(i));
    const dropCount = Math.max(1, Math.floor(accessoryIdx.length / 3));
    const byDropOrder = [...accessoryIdx].sort(
      (a, b) => (ordered[b].priority ?? 2) - (ordered[a].priority ?? 2) || b - a,
    );
    const dropped = new Set([
      ...byDropOrder.filter((i) => ordered[i].priority === 3),
      ...byDropOrder.slice(0, dropCount),
    ]);

    scaled = ordered.map((e, i) => {
      if (dropped.has(i)) {
        return { source: e, action: "drop" as const, sets: null, reps: null, percentOfTm: null, note: "Skipped today" };
      }
      const sets = parseCount(e.sets);
      if (primaries.has(i)) {
        // The primary movement always survives — that is what makes this a real session
        // rather than a consolation prize.
        const next = Math.max(1, sets - 1);
        return {
          source: e,
          action: next < sets ? ("reduce" as const) : ("keep" as const),
          sets: String(next),
          reps: e.reps,
          percentOfTm: e.percentOfTm ?? null,
          note: next < sets ? `${next} sets instead of ${sets}` : "Unchanged",
        };
      }
      // One set off, not half: combined with dropping the tail, halving overshoots.
      const next = Math.max(1, sets - 1);
      return {
        source: e,
        action: next < sets ? ("reduce" as const) : ("keep" as const),
        sets: String(next),
        reps: e.reps,
        percentOfTm: e.percentOfTm ?? null,
        note: next < sets ? `${next} sets instead of ${sets}` : "Unchanged",
      };
    });
  }

  const after = totalVolume(
    scaled.filter((e) => e.action !== "drop").map((e) => ({ sets: e.sets, reps: e.reps })),
  );
  const volumeReductionPct = before === 0 ? 0 : Math.round(((before - after) / before) * 100);

  const kept = scaled.filter((e) => e.action !== "drop").length;

  return {
    mode: "rough_shift",
    reason,
    exercises: scaled,
    volumeReductionPct,
    nearMaximal,
    usedAuthoredVariant: hasAuthored,
    summary:
      kept === 0
        ? "Nothing left to do today — take the rest."
        : `${kept} exercise${kept === 1 ? "" : "s"}, about ${volumeReductionPct}% less work. This still counts.`,
    safetyNote,
  };
}
