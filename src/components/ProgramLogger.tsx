"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { DraftStatus } from "@/components/DraftStatus";
import type { FlatDay } from "@/lib/program";
import type { JokerRequest, ReadinessCheckin, ReadinessTier, WorkoutLog } from "@/lib/types";
import { AchievementToast } from "@/components/AchievementToast";
import { lastPerformanceFor, formatSets } from "@/lib/workoutHistory";
import { workingWeight } from "@/lib/trainingMax";
import { phaseForWeek } from "@/lib/meetPrep/generateProgram";
import { readLocalDraft, writeLocalDraft } from "@/lib/localDraft";
import { useDraftSync } from "@/lib/hooks/useDraftSync";
import { reconcileSets, type SetInput } from "@/lib/workoutDraft";

const READINESS_FIELDS: { key: keyof ReadinessFormState; label: string }[] = [
  { key: "sleep", label: "Sleep Quality" },
  { key: "fatigue", label: "General Fatigue" },
  { key: "soreness", label: "Muscle Soreness" },
  { key: "jointPain", label: "Joint Pain" },
  { key: "stress", label: "Stress" },
  { key: "motivation", label: "Motivation" },
  { key: "nutrition", label: "Nutrition Quality" },
  { key: "confidence", label: "Confidence" },
];

interface ReadinessFormState {
  sleep: number;
  fatigue: number;
  soreness: number;
  jointPain: number;
  stress: number;
  motivation: number;
  nutrition: number;
  confidence: number;
}

function isMeetTopSingle(ex: FlatDay["exercises"][number]): boolean {
  return (ex.liftKey === "meet_bench" || ex.liftKey === "meet_deadlift") && ex.name.endsWith("— Top Single");
}

interface DeviationDraft {
  exerciseName: string;
  liftKey: string;
  prescribedWeight: number;
  actualWeight: number;
  reason: string;
  painScore: string;
  technicalRating: string;
}

interface DraftPayload {
  sets: Record<string, SetInput[]>;
  tmResults: Record<string, "hit" | "miss">;
}

function buildInitialSets(
  day: FlatDay,
  history: WorkoutLog[],
  trainingMaxes: Record<string, number>
): Record<string, SetInput[]> {
  const map: Record<string, SetInput[]> = {};
  for (const ex of day.exercises) {
    const n = typeof ex.sets === "number" ? ex.sets : parseInt(String(ex.sets), 10) || 1;
    const last = lastPerformanceFor(history, ex);
    const tm = ex.liftKey ? trainingMaxes[ex.liftKey] : undefined;
    const increment = ex.unit === "kg" ? 2.5 : 5;
    const prescribedWeight =
      tm != null && ex.percentOfTm != null ? workingWeight(tm, ex.percentOfTm, increment) : null;
    const prescribedReps = parseInt(String(ex.reps), 10);
    map[ex.name] = Array.from({ length: n }, (_, i) => {
      const lastSet = last?.exercise.sets[i];
      return {
        reps: prescribedWeight != null && !Number.isNaN(prescribedReps) ? String(prescribedReps) : "",
        weight:
          prescribedWeight != null
            ? String(prescribedWeight)
            : lastSet?.weight != null
            ? String(lastSet.weight)
            : "",
        rpe: "",
      };
    });
  }
  return map;
}

function loadLocalOrDefault(
  localKey: string,
  day: FlatDay | undefined,
  recentLogs: WorkoutLog[],
  trainingMaxes: Record<string, number>
): DraftPayload {
  const defaults = day ? buildInitialSets(day, recentLogs, trainingMaxes) : {};
  const draft = readLocalDraft<DraftPayload>(localKey);
  if (!draft) return { sets: defaults, tmResults: {} };
  return { sets: reconcileSets(draft.sets, defaults), tmResults: draft.tmResults ?? {} };
}

async function fetchServerDraftFallback(
  draftKey: string,
  localKey: string,
  apply: (payload: DraftPayload) => void
) {
  try {
    const res = await fetch(`/api/drafts?formType=workout&draftKey=${encodeURIComponent(draftKey)}`);
    const data = await res.json();
    if (data?.draft?.payload) {
      apply(data.draft.payload as DraftPayload);
      writeLocalDraft(localKey, data.draft.payload);
    }
  } catch {
    // offline / unreachable — nothing to fall back to, local state stands.
  }
}

export function ProgramLogger({
  programId,
  days,
  defaultIndex,
  recentLogs,
  trainingMaxes = {},
  profileId,
  initialReadiness = null,
  initialJokerRequests = [],
}: {
  programId: string;
  days: FlatDay[];
  defaultIndex: number;
  recentLogs: WorkoutLog[];
  trainingMaxes?: Record<string, number>;
  profileId: string;
  initialReadiness?: ReadinessCheckin | null;
  initialJokerRequests?: JokerRequest[];
}) {
  const [dayIndex, setDayIndex] = useState(defaultIndex);
  const day = days[dayIndex];

  const [readiness, setReadiness] = useState<ReadinessCheckin | null>(initialReadiness);
  const [readinessForm, setReadinessForm] = useState<ReadinessFormState>({
    sleep: 3,
    fatigue: 3,
    soreness: 3,
    jointPain: 1,
    stress: 3,
    motivation: 3,
    nutrition: 3,
    confidence: 3,
  });
  const [savingReadiness, setSavingReadiness] = useState(false);

  const [jokerRequests, setJokerRequests] = useState<JokerRequest[]>(initialJokerRequests);
  const [jokerErrors, setJokerErrors] = useState<Record<string, string[]>>({});
  const [jokerBusy, setJokerBusy] = useState<Record<string, boolean>>({});
  const [jokerResultDrafts, setJokerResultDrafts] = useState<Record<string, { weight: string; rpe: string }>>({});
  const [jokerSetIndex, setJokerSetIndex] = useState<Record<string, number>>({});

  const [pendingDeviations, setPendingDeviations] = useState<DeviationDraft[] | null>(null);

  const localKey = `jcf-draft-workout-${profileId}-${programId}-${dayIndex}`;
  const draftKey = `${programId}:${dayIndex}`;

  const [initialDraft] = useState(() => loadLocalOrDefault(localKey, day, recentLogs, trainingMaxes));
  const [sets, setSets] = useState<Record<string, SetInput[]>>(initialDraft.sets);
  const [tmResults, setTmResults] = useState<Record<string, "hit" | "miss">>(initialDraft.tmResults);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; description: string }[] | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // New-device / lost-local-draft recovery: if there's no local draft for the
  // day currently shown, check whether the server has one before assuming the
  // prescribed defaults are really what the client wants.
  useEffect(() => {
    if (readLocalDraft(localKey)) return;
    let cancelled = false;
    fetchServerDraftFallback(draftKey, localKey, (payload) => {
      if (cancelled) return;
      // A server-recovered draft can be arbitrarily old — reconcile it against
      // the program's current exercises the same way a local one is.
      setSets(reconcileSets(payload.sets, day ? buildInitialSets(day, recentLogs, trainingMaxes) : {}));
      setTmResults(payload.tmResults ?? {});
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayIndex]);

  const draftData = useMemo(() => ({ sets, tmResults }), [sets, tmResults]);
  const { status: draftStatus, clear: clearDraft } = useDraftSync({
    localKey,
    formType: "workout",
    draftKey,
    data: draftData,
  });

  function changeDay(i: number) {
    setDayIndex(i);
    const newLocalKey = `jcf-draft-workout-${profileId}-${programId}-${i}`;
    const loaded = loadLocalOrDefault(newLocalKey, days[i], recentLogs, trainingMaxes);
    setSets(loaded.sets);
    setTmResults(loaded.tmResults);
  }

  function updateSet(exName: string, idx: number, field: keyof SetInput, value: string) {
    setSets((prev) => {
      const next = { ...prev };
      next[exName] = [...next[exName]];
      next[exName][idx] = { ...next[exName][idx], [field]: value };
      return next;
    });
  }

  function markResult(ex: FlatDay["exercises"][number], result: "hit" | "miss") {
    // Only the legacy lb-based hit/miss lifts auto-adjust their training max.
    // Meet-prep lifts (meet_bench/meet_deadlift) log normally with no auto-bump.
    if (ex.liftKey !== "bench" && ex.liftKey !== "deadlift") return;
    setTmResults((prev) => ({ ...prev, [ex.name]: result }));
    const tm = ex.liftKey ? trainingMaxes[ex.liftKey] : undefined;
    if (tm == null || ex.percentOfTm == null) return;
    const prescribedWeight = workingWeight(tm, ex.percentOfTm);
    const prescribedReps = parseInt(String(ex.reps), 10);
    if (result === "hit") {
      // Confirm every set landed at the prescribed weight/reps (unless the
      // coach/client already typed an audible adjustment for a specific set).
      setSets((prev) => ({
        ...prev,
        [ex.name]: prev[ex.name].map((s) => ({
          ...s,
          weight: s.weight || String(prescribedWeight),
          reps: s.reps || (Number.isNaN(prescribedReps) ? s.reps : String(prescribedReps)),
        })),
      }));
    }
  }

  async function submitReadiness() {
    setSavingReadiness(true);
    setReadinessError(null);
    try {
      const res = await fetch("/api/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(readinessForm),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) setReadiness(data.readiness);
      else setReadinessError(data?.error ?? "Couldn't save your check-in. Try again.");
    } catch {
      setReadinessError("You appear to be offline — your check-in wasn't saved.");
    } finally {
      setSavingReadiness(false);
    }
  }

  function jokerRequestForLift(week: number, liftKey: string): JokerRequest | undefined {
    return jokerRequests
      .filter((r) => r.week_number === week && r.lift === liftKey)
      .sort((a, b) => (a.requested_at < b.requested_at ? 1 : -1))[0];
  }

  async function requestJoker(ex: FlatDay["exercises"][number]) {
    if (!ex.liftKey || !day) return;
    const firstSet = sets[ex.name]?.[0];
    if (!firstSet?.weight || !firstSet?.rpe) return;
    setJokerBusy((prev) => ({ ...prev, [ex.name]: true }));
    setJokerErrors((prev) => ({ ...prev, [ex.name]: [] }));
    try {
      const res = await fetch("/api/joker-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lift: ex.liftKey,
          weekNumber: day.week,
          topSingleWeight: Number(firstSet.weight),
          topSingleRpe: Number(firstSet.rpe),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setJokerRequests((prev) => [...prev, data.jokerRequest]);
      } else {
        setJokerErrors((prev) => ({ ...prev, [ex.name]: data.reasons ?? [data.error ?? "Not eligible."] }));
      }
    } finally {
      setJokerBusy((prev) => ({ ...prev, [ex.name]: false }));
    }
  }

  function addJokerResultSet(ex: FlatDay["exercises"][number]) {
    setSets((prev) => {
      const current = prev[ex.name] ?? [];
      setJokerSetIndex((idx) => ({ ...idx, [ex.name]: current.length }));
      return { ...prev, [ex.name]: [...current, { reps: "1", weight: "", rpe: "" }] };
    });
  }

  async function submitJokerResult(ex: FlatDay["exercises"][number], jokerRequest: JokerRequest, failed: boolean) {
    const draft = jokerResultDrafts[ex.name];
    if (!draft?.weight || !draft?.rpe) return;
    setJokerBusy((prev) => ({ ...prev, [ex.name]: true }));
    try {
      const res = await fetch(`/api/joker-requests/${jokerRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: failed ? "failed_compliance" : "completed",
          actualWeight: Number(draft.weight),
          actualRpe: Number(draft.rpe),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setJokerRequests((prev) => prev.map((r) => (r.id === jokerRequest.id ? data.jokerRequest : r)));
        const idx = jokerSetIndex[ex.name];
        if (idx != null) {
          updateSet(ex.name, idx, "weight", draft.weight);
          updateSet(ex.name, idx, "rpe", draft.rpe);
        }
      }
    } finally {
      setJokerBusy((prev) => ({ ...prev, [ex.name]: false }));
    }
  }

  async function save() {
    if (!day) return;

    // Deviation check: any TM-driven meet-lift set logged above the prescribed
    // weight without an approved/completed joker set needs a reason before saving.
    if (!pendingDeviations) {
      const deviations: DeviationDraft[] = [];
      for (const ex of day.exercises) {
        if (!ex.liftKey?.startsWith("meet_") || ex.percentOfTm == null) continue;
        const tm = trainingMaxes[ex.liftKey];
        if (tm == null) continue;
        const increment = ex.unit === "kg" ? 2.5 : 5;
        const prescribed = workingWeight(tm, ex.percentOfTm, increment);
        const excusedIndex = jokerSetIndex[ex.name];
        (sets[ex.name] ?? []).forEach((s, idx) => {
          if (idx === excusedIndex) return;
          const w = Number(s.weight);
          if (w && w > prescribed * 1.02) {
            deviations.push({
              exerciseName: ex.name,
              liftKey: ex.liftKey!,
              prescribedWeight: prescribed,
              actualWeight: w,
              reason: "",
              painScore: "0",
              technicalRating: "5",
            });
          }
        });
      }
      if (deviations.length > 0) {
        setPendingDeviations(deviations);
        return;
      }
    }

    setSaving(true);
    setSaveError(null);
    try {
      const exercisesCompleted = day.exercises.map((ex) => ({
        name: ex.name,
        // Carried from the prescription so this log stays joinable to the exercise
        // even if the coach renames it later.
        exerciseId: ex.exerciseId,
        unit: ex.unit ?? "lb",
        // Defaulted rather than indexed blind: reconcileSets should always have
        // populated this, but a missing key here used to throw and kill the save
        // with no feedback at all. An empty set list is a recoverable outcome.
        sets: (sets[ex.name] ?? []).map((s) => ({
          reps: s.reps ? Number(s.reps) : null,
          weight: s.weight ? Number(s.weight) : null,
          rpe: s.rpe ? Number(s.rpe) : null,
        })),
      }));

      const trainingMaxAdjustments = day.exercises
        .filter((ex) => (ex.liftKey === "bench" || ex.liftKey === "deadlift") && tmResults[ex.name])
        .map((ex) => ({ lift: ex.liftKey, hit: tmResults[ex.name] === "hit" }));

      const deviationReports = (pendingDeviations ?? []).map((d) => ({
        exerciseName: d.exerciseName,
        liftKey: d.liftKey,
        weekNumber: day.week,
        prescribedWeight: d.prescribedWeight,
        actualWeight: d.actualWeight,
        reason: d.reason,
        painScore: d.painScore ? Number(d.painScore) : null,
        technicalRating: d.technicalRating ? Number(d.technicalRating) : null,
      }));

      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId,
          dayLabel: `Week ${day.week} — ${day.label}`,
          exercisesCompleted,
          completed: true,
          trainingMaxAdjustments,
          deviationReports,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        clearDraft();
        setPendingDeviations(null);
        if (data?.newAchievements?.length) {
          setToast(data.newAchievements);
        } else {
          setToast([{ title: "Workout Logged", description: "Nice work — see you next session." }]);
        }
      } else {
        // The draft is deliberately left intact — nothing typed is lost, and
        // retrying is the right next move.
        setSaveError(data?.error ?? "Couldn't save this workout. Your entries are still saved as a draft.");
      }
    } catch {
      setSaveError("You appear to be offline. Your entries are saved as a draft — try again once you're back.");
    } finally {
      setSaving(false);
    }
  }

  if (!day) return null;

  const dayNeedsReadiness = day.exercises.some((ex) => ex.liftKey === "meet_bench" || ex.liftKey === "meet_deadlift");

  if (dayNeedsReadiness && !readiness) {
    return (
      <div className="bg-jcf-panel border border-white/10 rounded-sm p-4">
        <h2 className="font-display uppercase tracking-wide text-sm text-jcf-gold mb-1">Readiness Check-In</h2>
        <p className="text-jcf-gray text-xs mb-4">A quick read before today&apos;s session — this shapes how heavy today gets.</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {READINESS_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-jcf-gray">{label}</label>
              <select
                value={readinessForm[key]}
                onChange={(e) => setReadinessForm((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                className="bg-jcf-black border border-white/15 rounded-sm px-2 py-2 text-sm text-white focus:outline-none focus:border-jcf-gold"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {readinessError && (
          <p role="alert" className="text-jcf-danger text-sm mb-2">
            {readinessError}
          </p>
        )}
        <Button onClick={submitReadiness} disabled={savingReadiness} className="w-full">
          {savingReadiness ? "Saving..." : "Continue to Workout"}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto jcf-scrollbar pb-3 mb-4">
        {days.map((d, i) => (
          <button
            key={i}
            onClick={() => changeDay(i)}
            className={`shrink-0 px-3 py-2 rounded-sm text-xs uppercase tracking-wide border ${
              i === dayIndex
                ? "bg-jcf-gold text-jcf-black border-jcf-gold font-semibold"
                : "border-white/15 text-jcf-gray hover:border-white/30"
            }`}
          >
            W{d.week} · {d.label.replace(/^Day \d+\s*—?\s*/, "")}
          </button>
        ))}
      </div>

      {day.weekNote && <p className="text-xs text-jcf-gray mb-4 italic">{day.weekNote}</p>}

      <div className="flex flex-col gap-4 mb-6">
        {day.exercises.map((ex) => {
          const last = lastPerformanceFor(recentLogs, ex);
          const tm = ex.liftKey ? trainingMaxes[ex.liftKey] : undefined;
          const isTmDriven = ex.liftKey != null && ex.percentOfTm != null && tm != null;
          const unitLabel = ex.unit === "kg" ? "kg" : "lb";
          const increment = ex.unit === "kg" ? 2.5 : 5;
          const rawPrescribedWeight = isTmDriven
            ? workingWeight(tm as number, ex.percentOfTm as number, increment)
            : null;
          const canMarkResult = isTmDriven && (ex.liftKey === "bench" || ex.liftKey === "deadlift");
          const result = tmResults[ex.name];

          const topSingle = isMeetTopSingle(ex);
          const blocksHeavy = topSingle && readiness != null && (readiness.tier === "very_low" || readiness.joint_pain >= 4);
          const reducesHeavy = topSingle && readiness != null && readiness.tier === "low";
          const prescribedWeight =
            reducesHeavy && rawPrescribedWeight != null ? workingWeight(rawPrescribedWeight, 95, increment) : rawPrescribedWeight;
          const showPrescription = isTmDriven && !blocksHeavy;

          const phase = topSingle ? phaseForWeek(day.week) : null;
          const jokerWindowOpen = topSingle && !!phase?.startsWith("Intensification") && !blocksHeavy;
          const jokerRequest = ex.liftKey ? jokerRequestForLift(day.week, ex.liftKey) : undefined;
          const jokerError = jokerErrors[ex.name] ?? [];
          const jokerIsBusy = !!jokerBusy[ex.name];

          return (
            <details key={ex.name} open className="group bg-jcf-panel border border-white/10 rounded-sm p-4">
              <summary className="flex items-baseline justify-between mb-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <h3 className="font-display uppercase text-sm tracking-wide">{ex.name}</h3>
                <span className="text-xs text-jcf-gray flex items-center gap-2">
                  {ex.sets}x{ex.reps} · rest {ex.rest}
                  <span className="inline-block transition-transform group-open:rotate-180">▾</span>
                </span>
              </summary>
              {ex.notes && <p className="text-xs text-jcf-gray mb-2">{ex.notes}</p>}
              {(ex.targetRpe || ex.rpeCap != null) && (
                <p className="text-[11px] text-jcf-gray mb-2">
                  {ex.targetRpe && <>Target RPE {ex.targetRpe}</>}
                  {ex.targetRpe && ex.rpeCap != null && " · "}
                  {ex.rpeCap != null && <>Cap RPE {ex.rpeCap}</>}
                </p>
              )}

              {blocksHeavy && (
                <div className="mb-3 pb-3 border-b border-white/10 text-xs text-jcf-danger">
                  Readiness is very low today{readiness && readiness.joint_pain >= 4 ? " (meaningful joint pain reported)" : ""} —
                  today&apos;s heavy single is held. Technique work only; Jon will review before your next heavy session.
                </div>
              )}
              {showPrescription && (
                <div className="flex items-baseline justify-between mb-3 pb-3 border-b border-white/10">
                  <span className="text-xs text-jcf-gray">
                    {ex.percentOfTm}% of {tm} {unitLabel} training max
                    {reducesHeavy && " · reduced ~5% for low readiness"}
                  </span>
                  <span className="text-jcf-gold font-display text-xl">
                    {prescribedWeight}
                    <span className="text-xs text-jcf-gray font-sans ml-1">{unitLabel} / set</span>
                  </span>
                </div>
              )}

              <div className="text-xs mb-3">
                {last ? (
                  <span className="text-jcf-gold">
                    Last time ({last.log.date}): {formatSets(last.exercise)}
                  </span>
                ) : (
                  <span className="text-jcf-gray">No previous log for this exercise yet.</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="grid grid-cols-[1.25rem_1fr_1fr_1fr] gap-1.5 sm:gap-2 text-[10px] uppercase text-jcf-gray tracking-wider">
                  <span>Set</span>
                  <span>Reps</span>
                  <span>Weight</span>
                  <span>RPE</span>
                </div>
                {sets[ex.name]?.map((s, idx) => (
                  <div key={idx} className="grid grid-cols-[1.25rem_1fr_1fr_1fr] gap-1.5 sm:gap-2 items-center">
                    <span className="text-jcf-gray text-sm">{idx + 1}</span>
                    <input
                      inputMode="numeric"
                      value={s.reps}
                      onChange={(e) => updateSet(ex.name, idx, "reps", e.target.value)}
                      aria-label={`${ex.name} set ${idx + 1} reps`}
                      className="w-full min-w-0 bg-jcf-black border border-white/15 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-jcf-gold"
                    />
                    <input
                      inputMode="decimal"
                      value={s.weight}
                      onChange={(e) => updateSet(ex.name, idx, "weight", e.target.value)}
                      placeholder={
                        last?.exercise.sets[idx]?.weight != null ? String(last.exercise.sets[idx].weight) : undefined
                      }
                      aria-label={`${ex.name} set ${idx + 1} weight`}
                      className="w-full min-w-0 bg-jcf-black border border-white/15 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-jcf-gold"
                    />
                    <input
                      inputMode="decimal"
                      value={s.rpe}
                      onChange={(e) => updateSet(ex.name, idx, "rpe", e.target.value)}
                      aria-label={`${ex.name} set ${idx + 1} RPE`}
                      className="w-full min-w-0 bg-jcf-black border border-white/15 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-jcf-gold"
                    />
                  </div>
                ))}
              </div>

              {canMarkResult && (
                <div className="mt-4">
                  <p className="text-[11px] text-jcf-gray mb-2">
                    Adjust weight or reps above if you called an audible, then mark the result.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => markResult(ex, "hit")}
                      className={`flex-1 py-2 rounded-sm text-xs uppercase tracking-wide font-semibold border ${
                        result === "hit"
                          ? "bg-green-600/80 border-green-500 text-white"
                          : "border-white/15 text-jcf-gray hover:border-green-500/60"
                      }`}
                    >
                      Hit — All Reps at Weight
                    </button>
                    <button
                      type="button"
                      onClick={() => markResult(ex, "miss")}
                      className={`flex-1 py-2 rounded-sm text-xs uppercase tracking-wide font-semibold border ${
                        result === "miss"
                          ? "bg-jcf-panel border-white/40 text-white"
                          : "border-white/15 text-jcf-gray hover:border-white/40"
                      }`}
                    >
                      Miss — Fell Short
                    </button>
                  </div>
                  <p className="text-[10px] text-jcf-gray mt-2">
                    Hit bumps this lift&apos;s training max ~4% for next time. Miss holds it flat.
                  </p>
                </div>
              )}

              {jokerWindowOpen && !jokerRequest && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    disabled={jokerIsBusy || !sets[ex.name]?.[0]?.weight || !sets[ex.name]?.[0]?.rpe}
                    onClick={() => requestJoker(ex)}
                    className="w-full py-2 rounded-sm text-xs uppercase tracking-wide font-semibold border border-jcf-gold/50 text-jcf-gold hover:bg-jcf-gold/10 disabled:opacity-40"
                  >
                    {jokerIsBusy ? "Requesting..." : "Request Joker Set"}
                  </button>
                  {jokerError.length > 0 && (
                    <ul className="mt-2 text-[11px] text-jcf-danger list-disc list-inside">
                      {jokerError.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {jokerRequest && jokerRequest.status === "pending" && (
                <div className="mt-4 pt-4 border-t border-white/10 text-xs text-jcf-gray">
                  Joker set requested — awaiting coach approval.
                </div>
              )}
              {jokerRequest && jokerRequest.status === "denied" && (
                <div className="mt-4 pt-4 border-t border-white/10 text-xs text-jcf-danger">
                  Joker set denied{jokerRequest.coach_response ? `: ${jokerRequest.coach_response}` : "."}
                </div>
              )}
              {jokerRequest && jokerRequest.status === "approved" && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-jcf-gold mb-2">
                    Joker approved — up to {jokerRequest.max_permitted_weight}
                    {unitLabel}. Log the result once you&apos;ve taken it.
                  </p>
                  {jokerSetIndex[ex.name] == null ? (
                    <button
                      type="button"
                      onClick={() => addJokerResultSet(ex)}
                      className="w-full py-2 rounded-sm text-xs uppercase tracking-wide font-semibold border border-jcf-gold/50 text-jcf-gold hover:bg-jcf-gold/10"
                    >
                      Add Joker Set Row
                    </button>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <input
                        inputMode="decimal"
                        placeholder={`Weight (${unitLabel})`}
                        aria-label={`Joker set actual weight (${unitLabel})`}
                        value={jokerResultDrafts[ex.name]?.weight ?? ""}
                        onChange={(e) =>
                          setJokerResultDrafts((prev) => ({ ...prev, [ex.name]: { weight: e.target.value, rpe: prev[ex.name]?.rpe ?? "" } }))
                        }
                        className="w-full min-w-0 bg-jcf-black border border-white/15 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-jcf-gold"
                      />
                      <input
                        inputMode="decimal"
                        placeholder="RPE"
                        aria-label="Joker set actual RPE"
                        value={jokerResultDrafts[ex.name]?.rpe ?? ""}
                        onChange={(e) =>
                          setJokerResultDrafts((prev) => ({ ...prev, [ex.name]: { weight: prev[ex.name]?.weight ?? "", rpe: e.target.value } }))
                        }
                        className="w-24 shrink-0 bg-jcf-black border border-white/15 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-jcf-gold"
                      />
                      <button
                        type="button"
                        disabled={jokerIsBusy}
                        onClick={() => submitJokerResult(ex, jokerRequest, Number(jokerResultDrafts[ex.name]?.rpe) > 8.5)}
                        className="shrink-0 px-3 py-1.5 rounded-sm text-xs uppercase tracking-wide font-semibold border border-jcf-gold/50 text-jcf-gold hover:bg-jcf-gold/10 disabled:opacity-40"
                      >
                        Log
                      </button>
                    </div>
                  )}
                </div>
              )}
              {jokerRequest && (jokerRequest.status === "completed" || jokerRequest.status === "failed_compliance") && (
                <div className="mt-4 pt-4 border-t border-white/10 text-xs text-jcf-gray">
                  Joker: {jokerRequest.actual_weight}
                  {unitLabel} @ RPE {jokerRequest.actual_rpe} —{" "}
                  {jokerRequest.status === "completed" ? "completed" : "missed"}.
                </div>
              )}
            </details>
          );
        })}
      </div>

      {pendingDeviations && pendingDeviations.length > 0 && (
        <div className="bg-jcf-panel border border-jcf-danger/40 rounded-sm p-4 mb-4">
          <h3 className="text-xs uppercase tracking-widest text-jcf-danger mb-1">Weight Above Prescribed Limit</h3>
          <p className="text-jcf-gray text-xs mb-3">
            This weight exceeds today&apos;s prescribed limit. Completing the program as written is the goal of this
            session — a few details for Jon&apos;s review, then you can save.
          </p>
          {pendingDeviations.map((d, i) => (
            <div key={i} className="mb-3 pb-3 border-b border-white/10 last:border-b-0 last:pb-0 last:mb-0">
              <p className="text-sm text-white mb-2">
                {d.exerciseName} — logged {d.actualWeight}, prescribed {d.prescribedWeight}
              </p>
              <div className="grid grid-cols-1 gap-2">
                <input
                  placeholder="Reason for the deviation"
                  aria-label={`Reason for the ${d.exerciseName} weight deviation`}
                  value={d.reason}
                  onChange={(e) =>
                    setPendingDeviations((prev) => prev!.map((x, xi) => (xi === i ? { ...x, reason: e.target.value } : x)))
                  }
                  className="bg-jcf-black border border-white/15 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-jcf-gold"
                />
                <div className="flex gap-2">
                  <input
                    inputMode="numeric"
                    placeholder="Pain score (0-5)"
                    aria-label={`Pain score for the ${d.exerciseName} deviation, 0 to 5`}
                    value={d.painScore}
                    onChange={(e) =>
                      setPendingDeviations((prev) => prev!.map((x, xi) => (xi === i ? { ...x, painScore: e.target.value } : x)))
                    }
                    className="w-full bg-jcf-black border border-white/15 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-jcf-gold"
                  />
                  <input
                    inputMode="numeric"
                    placeholder="Technical rating (1-5)"
                    aria-label={`Technical rating for the ${d.exerciseName} deviation, 1 to 5`}
                    value={d.technicalRating}
                    onChange={(e) =>
                      setPendingDeviations((prev) => prev!.map((x, xi) => (xi === i ? { ...x, technicalRating: e.target.value } : x)))
                    }
                    className="w-full bg-jcf-black border border-white/15 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-jcf-gold"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <DraftStatus status={draftStatus} />
      </div>
      {saveError && (
        <p role="alert" className="text-jcf-danger text-sm mb-2">
          {saveError}
        </p>
      )}
      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? "Saving..." : pendingDeviations ? "Confirm & Save" : "Mark Complete & Save"}
      </Button>

      {toast && <AchievementToast items={toast} onClose={() => setToast(null)} />}

      {recentLogs.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display uppercase tracking-wider text-sm text-jcf-gold mb-3">Recent Logs</h2>
          <div className="flex flex-col gap-2">
            {recentLogs.slice(0, 15).map((log) => {
              const isOpen = expandedLog === log.id;
              return (
                <div key={log.id} className="bg-jcf-panel border border-white/10 rounded-sm px-4 py-3">
                  <button
                    className="flex items-center justify-between w-full text-left"
                    onClick={() => setExpandedLog(isOpen ? null : log.id)}
                  >
                    <span className="text-sm">{log.day_label ?? "Workout"}</span>
                    <span className="text-jcf-gray text-xs">{log.date} {isOpen ? "▲" : "▼"}</span>
                  </button>
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-1.5">
                      {log.exercises_completed.map((ex, i) => (
                        <div key={i} className="text-xs flex justify-between gap-3">
                          <span className="text-white">{ex.name}</span>
                          <span className="text-jcf-gray text-right">{formatSets(ex) || "—"}</span>
                        </div>
                      ))}
                      {log.exercises_completed.length === 0 && (
                        <p className="text-jcf-gray text-xs">No set details recorded.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
