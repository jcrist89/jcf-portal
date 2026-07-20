"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import type { FlatDay } from "@/lib/program";
import type { WorkoutLog } from "@/lib/types";
import { AchievementToast } from "@/components/AchievementToast";
import { lastPerformanceFor, formatSets } from "@/lib/workoutHistory";

interface SetInput {
  reps: string;
  weight: string;
  rpe: string;
}

function buildInitialSets(day: FlatDay, history: WorkoutLog[]): Record<string, SetInput[]> {
  const map: Record<string, SetInput[]> = {};
  for (const ex of day.exercises) {
    const n = typeof ex.sets === "number" ? ex.sets : parseInt(String(ex.sets), 10) || 1;
    const last = lastPerformanceFor(history, ex.name);
    map[ex.name] = Array.from({ length: n }, (_, i) => {
      const lastSet = last?.exercise.sets[i];
      return {
        reps: "",
        weight: lastSet?.weight != null ? String(lastSet.weight) : "",
        rpe: "",
      };
    });
  }
  return map;
}

export function ProgramLogger({
  programId,
  days,
  defaultIndex,
  recentLogs,
}: {
  programId: string;
  days: FlatDay[];
  defaultIndex: number;
  recentLogs: WorkoutLog[];
}) {
  const [dayIndex, setDayIndex] = useState(defaultIndex);
  const day = days[dayIndex];

  const initialSets = useMemo(() => (day ? buildInitialSets(day, recentLogs) : {}), [day, recentLogs]);
  const [sets, setSets] = useState<Record<string, SetInput[]>>(initialSets);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ title: string; description: string }[] | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  function changeDay(i: number) {
    setDayIndex(i);
    setSets(buildInitialSets(days[i], recentLogs));
  }

  function updateSet(exName: string, idx: number, field: keyof SetInput, value: string) {
    setSets((prev) => {
      const next = { ...prev };
      next[exName] = [...next[exName]];
      next[exName][idx] = { ...next[exName][idx], [field]: value };
      return next;
    });
  }

  async function save() {
    if (!day) return;
    setSaving(true);
    try {
      const exercisesCompleted = day.exercises.map((ex) => ({
        name: ex.name,
        sets: sets[ex.name].map((s) => ({
          reps: s.reps ? Number(s.reps) : null,
          weight: s.weight ? Number(s.weight) : null,
          rpe: s.rpe ? Number(s.rpe) : null,
        })),
      }));

      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId,
          dayLabel: `Week ${day.week} — ${day.label}`,
          exercisesCompleted,
          completed: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.newAchievements?.length) {
        setToast(data.newAchievements);
      } else if (res.ok) {
        setToast([{ title: "Workout Logged", description: "Nice work — see you next session." }]);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!day) return null;

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
          const last = lastPerformanceFor(recentLogs, ex.name);
          return (
            <div key={ex.name} className="bg-jcf-panel border border-white/10 rounded-sm p-4">
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="font-display uppercase text-sm tracking-wide">{ex.name}</h3>
                <span className="text-xs text-jcf-gray">
                  {ex.sets}x{ex.reps} · rest {ex.rest}
                </span>
              </div>
              {ex.notes && <p className="text-xs text-jcf-gray mb-2">{ex.notes}</p>}
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
                <div className="grid grid-cols-[2rem_1fr_1fr_1fr] gap-2 text-[10px] uppercase text-jcf-gray tracking-wider">
                  <span>Set</span>
                  <span>Reps</span>
                  <span>Weight</span>
                  <span>RPE</span>
                </div>
                {sets[ex.name]?.map((s, idx) => (
                  <div key={idx} className="grid grid-cols-[2rem_1fr_1fr_1fr] gap-2">
                    <span className="text-jcf-gray text-sm pt-2">{idx + 1}</span>
                    <input
                      inputMode="numeric"
                      value={s.reps}
                      onChange={(e) => updateSet(ex.name, idx, "reps", e.target.value)}
                      className="bg-jcf-black border border-white/15 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-jcf-gold"
                    />
                    <input
                      inputMode="decimal"
                      value={s.weight}
                      onChange={(e) => updateSet(ex.name, idx, "weight", e.target.value)}
                      placeholder={
                        last?.exercise.sets[idx]?.weight != null ? String(last.exercise.sets[idx].weight) : undefined
                      }
                      className="bg-jcf-black border border-white/15 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-jcf-gold"
                    />
                    <input
                      inputMode="decimal"
                      value={s.rpe}
                      onChange={(e) => updateSet(ex.name, idx, "rpe", e.target.value)}
                      className="bg-jcf-black border border-white/15 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-jcf-gold"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? "Saving..." : "Mark Complete & Save"}
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
