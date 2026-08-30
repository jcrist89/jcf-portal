"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { DraftStatus } from "@/components/DraftStatus";
import { readLocalDraft } from "@/lib/localDraft";
import { useDraftSync } from "@/lib/hooks/useDraftSync";

type Fields = Record<string, string>;

const EMPTY: Fields = {
  weight: "", waist: "", sleep_avg: "", night_shifts: "", steps_avg: "",
  nutrition_adherence: "", protein_days: "", alcohol_drinks: "",
  energy: "", stress: "", win: "", struggle: "", ask: "",
};

const NUMBER_FIELDS: Array<{ key: string; label: string; hint?: string; step?: string }> = [
  { key: "weight", label: "Weight (lb)", step: "0.1" },
  { key: "waist", label: "Waist (in)", step: "0.1" },
  { key: "sleep_avg", label: "Sleep (hrs/night)", step: "0.5" },
  { key: "night_shifts", label: "Night shifts" },
  { key: "steps_avg", label: "Steps/day" },
  { key: "protein_days", label: "Days you hit protein", hint: "0–7" },
  { key: "alcohol_drinks", label: "Drinks this week" },
  { key: "nutrition_adherence", label: "Nutrition 1–10" },
  { key: "energy", label: "Energy 1–10" },
  { key: "stress", label: "Stress 1–10" },
];

/**
 * The weekly check-in.
 *
 * Two required answers — weight and waist — and everything else optional. The form has
 * to be finishable in under three minutes by someone who just came off a night shift,
 * and a required field they don't have an answer for is exactly where they abandon it
 * and never come back.
 *
 * Drafts save locally on every change, so a half-finished check-in survives the app
 * being closed, the phone dying, or a tunnel.
 */
export function CheckinForm({
  profileId,
  dueOn,
  initial,
}: {
  profileId: string;
  dueOn: string;
  initial?: Fields | null;
}) {
  const router = useRouter();
  const localKey = `jcf-draft-checkin-${profileId}-${dueOn}`;

  const [fields, setFields] = useState<Fields>(
    () => initial ?? readLocalDraft<Fields>(localKey) ?? EMPTY,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { status, clear } = useDraftSync({
    localKey,
    formType: "measurement",
    draftKey: `checkin:${dueOn}`,
    data: fields,
  });

  function set(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!fields.weight || !fields.waist) {
      setError("Weight and waist are the two we need. Everything else is optional.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not send your check-in.");
      clear();
      router.refresh();
    } catch (e) {
      // The draft is deliberately left intact — nothing typed is lost, and retrying is
      // the right next move.
      setError(
        e instanceof Error && e.message !== "Failed to fetch"
          ? e.message
          : "You appear to be offline. Your answers are saved — try again when you're back.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-jcf-gray text-sm">Week of {dueOn}. Takes about two minutes.</p>
        <DraftStatus status={status} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {NUMBER_FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-jcf-gray">
              {f.label}
              {(f.key === "weight" || f.key === "waist") && <span className="text-jcf-gold"> *</span>}
            </span>
            <input
              type="number"
              inputMode="decimal"
              step={f.step ?? "1"}
              value={fields[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.hint}
              className="bg-jcf-charcoal border border-white/15 rounded-sm px-3 py-2 text-white focus:border-jcf-gold outline-none"
            />
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-4 mb-6">
        {[
          { key: "win", label: "Biggest win this week" },
          { key: "struggle", label: "Biggest struggle" },
          { key: "ask", label: "Anything you want Jon to look at" },
        ].map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-jcf-gray">{f.label}</span>
            <textarea
              rows={2}
              value={fields[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              className="bg-jcf-charcoal border border-white/15 rounded-sm px-3 py-2 text-white focus:border-jcf-gold outline-none resize-y"
            />
          </label>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-jcf-danger text-sm mb-3">
          {error}
        </p>
      )}

      <Button onClick={submit} disabled={saving} className="w-full">
        {saving ? "Sending…" : "Send check-in"}
      </Button>
    </div>
  );
}
