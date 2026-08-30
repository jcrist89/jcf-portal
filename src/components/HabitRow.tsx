"use client";
import { useState, useTransition } from "react";
import { HABIT_KEYS, habitCount, todayHabitMessage, type HabitKey } from "@/domain/consistency";

const LABELS: Record<HabitKey, string> = {
  protein: "Protein",
  steps: "Steps",
  water: "Water",
  sleep: "Sleep",
};

export type HabitState = Record<HabitKey, boolean>;

export const EMPTY_HABITS: HabitState = { protein: false, steps: false, water: false, sleep: false };

/**
 * The Big 4, as four one-tap controls.
 *
 * Optimistic: the tile flips immediately and the request follows. An exhausted person on
 * one bar of signal should never wait on a round trip to find out whether their tap
 * registered — and because habit_days is keyed on (profile, date), a tap that is retried
 * or replayed converges on the same row rather than double-counting.
 *
 * On failure the tile reverts and says so. Silently keeping an optimistic value that
 * never reached the server is worse than a visible failure: it teaches the client the
 * app is lying to them.
 */
export function HabitRow({
  initial,
  localDate,
  readOnly = false,
}: {
  initial: HabitState;
  localDate: string;
  readOnly?: boolean;
}) {
  const [habits, setHabits] = useState<HabitState>(initial);
  const [failed, setFailed] = useState<HabitKey | null>(null);
  const [, startTransition] = useTransition();

  async function toggle(key: HabitKey) {
    if (readOnly) return;
    const next = !habits[key];
    setHabits((prev) => ({ ...prev, [key]: next }));
    setFailed(null);

    try {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habit: key, done: next, localDate }),
      });
      if (!res.ok) throw new Error("save failed");
      // Keeps the rolling count on the rest of the page honest without a reload.
      startTransition(() => {});
    } catch {
      setHabits((prev) => ({ ...prev, [key]: !next }));
      setFailed(key);
    }
  }

  const count = habitCount(habits);

  return (
    <section aria-labelledby="daily-four" className="mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <h2 id="daily-four" className="text-[10px] uppercase tracking-[0.2em] text-jcf-gray">
          Daily Four
        </h2>
        <span className={`text-xs ${count >= 3 ? "text-jcf-success" : "text-jcf-gray"}`}>
          {todayHabitMessage(habits)}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {HABIT_KEYS.map((key) => {
          const on = habits[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              disabled={readOnly}
              aria-pressed={on}
              aria-label={`${LABELS[key]}${on ? ", done" : ", not done"}`}
              className={`rounded-sm border py-4 px-1 text-center transition-colors ${
                on
                  ? "border-jcf-success bg-jcf-success/15 text-jcf-success"
                  : "border-white/15 text-jcf-gray hover:border-white/30"
              } ${readOnly ? "cursor-not-allowed opacity-80" : ""}`}
            >
              <span className="block font-display uppercase text-[11px] tracking-wider">
                {LABELS[key]}
              </span>
              <span className="block text-lg leading-none mt-1" aria-hidden="true">
                {on ? "✓" : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {failed && (
        <p role="status" className="text-jcf-danger text-xs mt-2">
          Couldn&apos;t save {LABELS[failed].toLowerCase()} — check your connection and tap it again.
        </p>
      )}
    </section>
  );
}
