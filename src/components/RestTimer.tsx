"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/workoutGuidance";

export function RestTimer({ seconds }: { seconds: number | null }) {
  const [remaining, setRemaining] = useState(seconds ?? 0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    // A changed exercise/rest prescription resets this independent timer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemaining(seconds ?? 0);
    setRunning(false);
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          setRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  if (!seconds) return null;
  const complete = remaining === 0;

  return (
    <div className="flex items-center gap-2 mt-3" aria-label={`Rest timer, ${formatDuration(seconds)}`}>
      <button
        type="button"
        onClick={() => {
          if (complete) setRemaining(seconds);
          setRunning((current) => (complete ? true : !current));
        }}
        className="px-3 py-1.5 border border-jcf-gold/50 text-jcf-gold rounded-sm text-[11px] uppercase tracking-wide hover:bg-jcf-gold/10"
      >
        {complete ? "Restart rest" : running ? "Pause rest" : "Start rest"}
      </button>
      <span aria-live="polite" className={`font-display text-lg ${complete ? "text-jcf-gold" : "text-white"}`}>
        {complete ? "Ready" : formatDuration(remaining)}
      </span>
    </div>
  );
}
