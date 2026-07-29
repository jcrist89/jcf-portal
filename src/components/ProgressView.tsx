"use client";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { DraftStatus } from "@/components/DraftStatus";
import { AchievementToast } from "@/components/AchievementToast";
import { readLocalDraft, writeLocalDraft } from "@/lib/localDraft";
import { useDraftSync } from "@/lib/hooks/useDraftSync";
import type { Measurement, PR } from "@/lib/types";

const LIFTS = ["squat", "bench", "deadlift", "overhead_press"];

export function ProgressView({
  measurements,
  prs,
  profileId,
}: {
  measurements: Measurement[];
  prs: PR[];
  profileId: string;
}) {
  const [tab, setTab] = useState<"weight" | "measurements" | "prs">("weight");
  const [toast, setToast] = useState<{ title: string; description: string }[] | null>(null);

  const weightData = measurements
    .filter((m) => m.weight != null)
    .map((m) => ({ date: m.date.slice(5), weight: m.weight }));

  const waistData = measurements
    .filter((m) => m.waist != null)
    .map((m) => ({ date: m.date.slice(5), waist: m.waist }));

  // Union of the default lift list and every lift that's actually shown up in
  // this client's PR history (auto-detected or manually logged), sorted for
  // stable chart ordering.
  const allLifts = Array.from(new Set([...LIFTS, ...prs.map((p) => p.lift)])).sort();

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {(["weight", "measurements", "prs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs uppercase tracking-wide rounded-sm border ${
              tab === t ? "bg-jcf-gold text-jcf-black border-jcf-gold font-semibold" : "border-white/15 text-jcf-gray"
            }`}
          >
            {t === "weight" ? "Weight" : t === "measurements" ? "Measurements" : "PRs"}
          </button>
        ))}
      </div>

      {tab === "weight" && (
        <>
          <ChartCard title="Weight Trend (lb)" data={weightData} dataKey="weight" />
          <LogMeasurementForm onLogged={setToast} focus="weight" profileId={profileId} />
        </>
      )}

      {tab === "measurements" && (
        <>
          <ChartCard title="Waist Trend (in)" data={waistData} dataKey="waist" />
          <LogMeasurementForm onLogged={setToast} focus="all" profileId={profileId} />
        </>
      )}

      {tab === "prs" && (
        <>
          {/* Auto-detected from workout logs, plus anything manually logged below — no
              hardcoded lift list, so any exercise that's ever set a new best gets its own chart. */}
          {allLifts.map((lift) => {
            const data = prs
              .filter((p) => p.lift === lift)
              .map((p) => ({ date: p.date.slice(5), weight: p.weight }));
            if (data.length === 0) return null;
            return <ChartCard key={lift} title={`${label(lift)} PR (lb)`} data={data} dataKey="weight" />;
          })}
          <LogPrForm onLogged={setToast} profileId={profileId} />
          <div className="mt-6 flex flex-col gap-2">
            {[...prs].reverse().map((p) => (
              <div key={p.id} className="bg-jcf-panel border border-white/10 rounded-sm px-4 py-3 flex justify-between text-sm">
                <span>{label(p.lift)}</span>
                <span className="text-jcf-gold">{p.weight} lb x {p.reps}</span>
                <span className="text-jcf-gray text-right">
                  {p.date}
                  {p.notes === "Auto-detected from workout log" && (
                    <span className="block text-[10px] uppercase tracking-wider text-jcf-gray/70">auto</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {toast && <AchievementToast items={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function label(lift: string) {
  return lift.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function ChartCard({ title, data, dataKey }: { title: string; data: any[]; dataKey: string }) {
  if (data.length === 0) return null;
  return (
    <div className="bg-jcf-panel border border-white/10 rounded-sm p-4 mb-4">
      <h3 className="text-xs uppercase tracking-widest text-jcf-gray mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid stroke="#2a2a2a" vertical={false} />
          <XAxis dataKey="date" stroke="#8A8A8A" fontSize={10} />
          <YAxis stroke="#8A8A8A" fontSize={10} domain={["auto", "auto"]} />
          <Tooltip contentStyle={{ background: "#151515", border: "1px solid #333", fontSize: 12 }} />
          <Line type="monotone" dataKey={dataKey} stroke="#D9A125" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface MeasurementDraft {
  weight: string;
  waist: string;
  chest: string;
  hips: string;
  arms: string;
  thighs: string;
}

const BLANK_MEASUREMENT_DRAFT: MeasurementDraft = {
  weight: "",
  waist: "",
  chest: "",
  hips: "",
  arms: "",
  thighs: "",
};

function LogMeasurementForm({
  onLogged,
  focus,
  profileId,
}: {
  onLogged: (a: { title: string; description: string }[]) => void;
  focus: "weight" | "all";
  profileId: string;
}) {
  const localKey = `jcf-draft-measurement-${profileId}`;
  const draftKey = "current";

  const [open, setOpen] = useState(() => readLocalDraft<MeasurementDraft>(localKey) != null);
  const [form, setForm] = useState<MeasurementDraft>(
    () => readLocalDraft<MeasurementDraft>(localKey) ?? BLANK_MEASUREMENT_DRAFT
  );
  const [saving, setSaving] = useState(false);

  const { status: draftStatus, clear: clearDraft } = useDraftSync({
    localKey,
    formType: "measurement",
    draftKey,
    data: form,
    enabled: open,
  });

  function update(field: keyof MeasurementDraft, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weight: form.weight ? Number(form.weight) : null,
          waist: form.waist ? Number(form.waist) : null,
          chest: form.chest ? Number(form.chest) : null,
          hips: form.hips ? Number(form.hips) : null,
          arms: form.arms ? Number(form.arms) : null,
          thighs: form.thighs ? Number(form.thighs) : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        clearDraft();
        if (data.newAchievements?.length) onLogged(data.newAchievements);
        setOpen(false);
        setForm(BLANK_MEASUREMENT_DRAFT);
        location.reload();
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">
        + Log New Check-In
      </Button>
    );
  }

  return (
    <div className="bg-jcf-panel border border-white/10 rounded-sm p-4">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Input label="Weight (lb)" type="number" value={form.weight} onChange={(e) => update("weight", e.target.value)} />
        {focus === "all" && (
          <>
            <Input label="Waist (in)" type="number" value={form.waist} onChange={(e) => update("waist", e.target.value)} />
            <Input label="Chest (in)" type="number" value={form.chest} onChange={(e) => update("chest", e.target.value)} />
            <Input label="Hips (in)" type="number" value={form.hips} onChange={(e) => update("hips", e.target.value)} />
            <Input label="Arms (in)" type="number" value={form.arms} onChange={(e) => update("arms", e.target.value)} />
            <Input label="Thighs (in)" type="number" value={form.thighs} onChange={(e) => update("thighs", e.target.value)} />
          </>
        )}
      </div>
      <DraftStatus status={draftStatus} />
      <div className="flex gap-3 mt-3">
        <Button
          variant="ghost"
          onClick={() => {
            clearDraft();
            setForm(BLANK_MEASUREMENT_DRAFT);
            setOpen(false);
          }}
        >
          Cancel
        </Button>
        <Button onClick={save} disabled={saving} className="flex-1">{saving ? "Saving..." : "Save Check-In"}</Button>
      </div>
    </div>
  );
}

interface PrDraft {
  lift: string;
  customLift: string;
  weight: string;
  reps: string;
}

const BLANK_PR_DRAFT: PrDraft = { lift: "squat", customLift: "", weight: "", reps: "1" };

function LogPrForm({
  onLogged,
  profileId,
}: {
  onLogged: (a: { title: string; description: string }[]) => void;
  profileId: string;
}) {
  const localKey = `jcf-draft-pr-${profileId}`;
  const draftKey = "current";

  const [open, setOpen] = useState(() => readLocalDraft<PrDraft>(localKey) != null);
  const [form, setForm] = useState<PrDraft>(() => readLocalDraft<PrDraft>(localKey) ?? BLANK_PR_DRAFT);
  const [saving, setSaving] = useState(false);

  const { status: draftStatus, clear: clearDraft } = useDraftSync({
    localKey,
    formType: "pr",
    draftKey,
    data: form,
    enabled: open,
  });

  function update(field: keyof PrDraft, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/prs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lift: form.lift === "custom" ? form.customLift : form.lift,
          weight: Number(form.weight),
          reps: Number(form.reps),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        clearDraft();
        if (data.newAchievements?.length) onLogged(data.newAchievements);
        setOpen(false);
        setForm(BLANK_PR_DRAFT);
        location.reload();
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="w-full mb-4">
        + Log New PR
      </Button>
    );
  }

  return (
    <div className="bg-jcf-panel border border-white/10 rounded-sm p-4 mb-4">
      <div className="flex flex-col gap-3 mb-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-jcf-gray">Lift</label>
          <select
            value={form.lift}
            onChange={(e) => update("lift", e.target.value)}
            className="bg-jcf-black border border-white/15 rounded-sm px-3 py-2.5 text-white"
          >
            {LIFTS.map((l) => (
              <option key={l} value={l}>{label(l)}</option>
            ))}
            <option value="custom">Custom...</option>
          </select>
        </div>
        {form.lift === "custom" && (
          <Input label="Custom Lift Name" value={form.customLift} onChange={(e) => update("customLift", e.target.value)} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Weight (lb)" type="number" value={form.weight} onChange={(e) => update("weight", e.target.value)} />
          <Input label="Reps" type="number" value={form.reps} onChange={(e) => update("reps", e.target.value)} />
        </div>
      </div>
      <DraftStatus status={draftStatus} />
      <div className="flex gap-3 mt-3">
        <Button
          variant="ghost"
          onClick={() => {
            clearDraft();
            setForm(BLANK_PR_DRAFT);
            setOpen(false);
          }}
        >
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || !form.weight} className="flex-1">{saving ? "Saving..." : "Save PR"}</Button>
      </div>
    </div>
  );
}
