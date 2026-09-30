"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Review = {
  week_start: string;
  wins: string | null;
  bottleneck: string | null;
  next_experiment: string | null;
  decisions: string | null;
  completed_at: string | null;
};

export function WeeklyBusinessReviewForm({
  weekStart,
  initial,
}: {
  weekStart: string;
  initial: Review | null;
}) {
  const router = useRouter();
  const [wins, setWins] = useState(initial?.wins ?? "");
  const [bottleneck, setBottleneck] = useState(initial?.bottleneck ?? "");
  const [nextExperiment, setNextExperiment] = useState(initial?.next_experiment ?? "");
  const [decisions, setDecisions] = useState(initial?.decisions ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(Boolean(initial?.completed_at));
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, wins, bottleneck, nextExperiment, decisions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save review.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-jcf-panel/80 p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-jcf-gray">Week of {weekStart}</div>
          <h3 className="font-display text-2xl uppercase">CEO Review</h3>
        </div>
        <span className={saved ? "text-xs uppercase tracking-widest text-jcf-success" : "text-xs uppercase tracking-widest text-jcf-gold"}>
          {saved ? "Saved" : "Open"}
        </span>
      </div>

      {error && <p className="mb-3 text-sm text-jcf-danger">{error}</p>}

      <div className="grid gap-4">
        <Area label="What worked?" value={wins} onChange={setWins} placeholder="Content, conversations, sales, delivery wins..." />
        <Area label="Primary bottleneck" value={bottleneck} onChange={setBottleneck} placeholder="Lead volume, qualification, no-shows, closing, delivery capacity..." />
        <Area label="One experiment next week" value={nextExperiment} onChange={setNextExperiment} placeholder="One change only, with a measurable outcome." />
        <Area label="Decisions / rules changed" value={decisions} onChange={setDecisions} placeholder="Pricing, CTA, targeting, schedule, SOP decisions..." />
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={save}
        className="mt-4 rounded-xl bg-[#FF6B1A] px-4 py-3 text-xs font-bold uppercase tracking-widest text-black disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save weekly review"}
      </button>
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="text-xs text-jcf-gray">
      <span className="mb-1 block uppercase tracking-widest">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-24 w-full rounded-xl border border-white/15 bg-jcf-black/40 px-3 py-3 text-sm text-white"
      />
    </label>
  );
}
