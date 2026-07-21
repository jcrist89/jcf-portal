"use client";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { AchievementToast } from "@/components/AchievementToast";
import type { Measurement, PR } from "@/lib/types";

const LIFTS = ["squat", "bench", "deadlift", "overhead_press"];

export function ProgressView({ measurements, prs }: { measurements: Measurement[]; prs: PR[] }) {
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
          <LogMeasurementForm onLogged={setToast} focus="weight" />
        </>
      )}

      {tab === "measurements" && (
        <>
          <ChartCard title="Waist Trend (in)" data={waistData} dataKey="waist" />
          <LogMeasurementForm onLogged={setToast} focus="all" />
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
          <LogPrForm onLogged={setToast} />
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

function LogMeasurementForm({
  onLogged,
  focus,
}: {
  onLogged: (a: { title: string; description: string }[]) => void;
  focus: "weight" | "all";
}) {
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [chest, setChest] = useState("");
  const [hips, setHips] = useState("");
  const [arms, setArms] = useState("");
  const [thighs, setThighs] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weight: weight ? Number(weight) : null,
          waist: waist ? Number(waist) : null,
          chest: chest ? Number(chest) : null,
          hips: hips ? Number(hips) : null,
          arms: arms ? Number(arms) : null,
          thighs: thighs ? Number(thighs) : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.newAchievements?.length) onLogged(data.newAchievements);
        setOpen(false);
        setWeight(""); setWaist(""); setChest(""); setHips(""); setArms(""); setThighs("");
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
        <Input label="Weight (lb)" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
        {focus === "all" && (
          <>
            <Input label="Waist (in)" type="number" value={waist} onChange={(e) => setWaist(e.target.value)} />
            <Input label="Chest (in)" type="number" value={chest} onChange={(e) => setChest(e.target.value)} />
            <Input label="Hips (in)" type="number" value={hips} onChange={(e) => setHips(e.target.value)} />
            <Input label="Arms (in)" type="number" value={arms} onChange={(e) => setArms(e.target.value)} />
            <Input label="Thighs (in)" type="number" value={thighs} onChange={(e) => setThighs(e.target.value)} />
          </>
        )}
      </div>
      <div className="flex gap-3">
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button onClick={save} disabled={saving} className="flex-1">{saving ? "Saving..." : "Save Check-In"}</Button>
      </div>
    </div>
  );
}

function LogPrForm({ onLogged }: { onLogged: (a: { title: string; description: string }[]) => void }) {
  const [open, setOpen] = useState(false);
  const [lift, setLift] = useState("squat");
  const [customLift, setCustomLift] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("1");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/prs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lift: lift === "custom" ? customLift : lift,
          weight: Number(weight),
          reps: Number(reps),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.newAchievements?.length) onLogged(data.newAchievements);
        setOpen(false);
        setWeight("");
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
            value={lift}
            onChange={(e) => setLift(e.target.value)}
            className="bg-jcf-black border border-white/15 rounded-sm px-3 py-2.5 text-white"
          >
            {LIFTS.map((l) => (
              <option key={l} value={l}>{label(l)}</option>
            ))}
            <option value="custom">Custom...</option>
          </select>
        </div>
        {lift === "custom" && (
          <Input label="Custom Lift Name" value={customLift} onChange={(e) => setCustomLift(e.target.value)} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Weight (lb)" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
          <Input label="Reps" type="number" value={reps} onChange={(e) => setReps(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3">
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button onClick={save} disabled={saving || !weight} className="flex-1">{saving ? "Saving..." : "Save PR"}</Button>
      </div>
    </div>
  );
}
