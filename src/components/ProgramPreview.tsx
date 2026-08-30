"use client";
import { useState } from "react";
import type { FlatDay } from "@/lib/program";
import type { WorkoutLog } from "@/lib/types";
import { workingWeight } from "@/lib/trainingMax";
import { lastPerformanceFor, formatSets } from "@/lib/workoutHistory";

/**
 * Read-only render of exactly what a client sees/gets pre-filled on their
 * /program page for a given day — same prescription math as ProgramLogger,
 * but with no inputs or save action. Lets a coach sanity-check units and
 * prescribed numbers without logging into the client's own account.
 */
export function ProgramPreview({
  days,
  trainingMaxes,
  recentLogs,
}: {
  days: FlatDay[];
  trainingMaxes: Record<string, number>;
  recentLogs: WorkoutLog[];
}) {
  const [index, setIndex] = useState(0);
  const day = days[index];

  if (days.length === 0) {
    return <p className="text-jcf-gray text-sm">No program days to preview.</p>;
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto jcf-scrollbar mb-4">
        {days.map((d, i) => (
          <button
            key={d.index}
            type="button"
            onClick={() => setIndex(i)}
            className={`shrink-0 px-3 py-2 text-xs uppercase tracking-wide rounded-sm border ${
              i === index
                ? "bg-jcf-gold text-jcf-black border-jcf-gold font-semibold"
                : "border-white/15 text-jcf-gray"
            }`}
          >
            W{d.week} · {d.label.replace(/^Day \d+\s*—?\s*/, "")}
          </button>
        ))}
      </div>

      {day.weekNote && <p className="text-xs text-jcf-gray mb-4 italic">{day.weekNote}</p>}

      <div className="flex flex-col gap-4">
        {day.exercises.map((ex) => {
          const last = lastPerformanceFor(recentLogs, ex);
          const tm = ex.liftKey ? trainingMaxes[ex.liftKey] : undefined;
          const isTmDriven = ex.liftKey != null && ex.percentOfTm != null && tm != null;
          const unitLabel = ex.unit === "kg" ? "kg" : "lb";
          const increment = ex.unit === "kg" ? 2.5 : 5;
          const prescribedWeight =
            isTmDriven ? workingWeight(tm as number, ex.percentOfTm as number, increment) : null;

          return (
            <div key={ex.name} className="bg-jcf-panel border border-white/10 rounded-sm p-4">
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="font-display uppercase text-sm tracking-wide">{ex.name}</h3>
                <span className="text-xs text-jcf-gray">
                  {ex.sets}x{ex.reps} · rest {ex.rest}
                </span>
              </div>
              {ex.notes && <p className="text-xs text-jcf-gray mb-2">{ex.notes}</p>}
              {(ex.targetRpe || ex.rpeCap != null) && (
                <p className="text-[11px] text-jcf-gray mb-2">
                  {ex.targetRpe && <>Target RPE {ex.targetRpe}</>}
                  {ex.targetRpe && ex.rpeCap != null && " · "}
                  {ex.rpeCap != null && <>Cap RPE {ex.rpeCap}</>}
                </p>
              )}

              {isTmDriven ? (
                <div className="flex items-baseline justify-between mb-2 pb-2 border-b border-white/10">
                  <span className="text-xs text-jcf-gray">
                    {ex.percentOfTm}% of {tm} {unitLabel} training max
                  </span>
                  <span className="text-jcf-gold font-display text-xl">
                    {prescribedWeight}
                    <span className="text-xs text-jcf-gray font-sans ml-1">{unitLabel} / set (pre-fills his Weight field)</span>
                  </span>
                </div>
              ) : (
                ex.liftKey && (
                  <p className="text-[11px] text-jcf-danger mb-2">
                    No training max on file for &quot;{ex.liftKey}&quot; — his Weight field will start blank or fall back to his last logged number for this exercise.
                  </p>
                )
              )}

              <div className="text-xs">
                {last ? (
                  <span className="text-jcf-gray">
                    Last time ({last.log.date}): {formatSets(last.exercise)}
                  </span>
                ) : (
                  <span className="text-jcf-gray">No previous log for this exercise yet.</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
