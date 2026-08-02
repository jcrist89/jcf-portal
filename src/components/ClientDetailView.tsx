"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { MessageThread } from "@/components/MessageThread";
import { AchievementIcon } from "@/components/AchievementIcon";
import { flattenProgram } from "@/lib/program";
import { formatSets } from "@/lib/workoutHistory";
import { ProgramPreview } from "@/components/ProgramPreview";
import type {
  Achievement,
  AttemptEntry,
  AttemptPlan,
  CoachNote,
  JokerRequest,
  Measurement,
  PR,
  Profile,
  Program,
  ProgramWeaknesses,
  TrainingMax,
  WorkoutLog,
} from "@/lib/types";
import { calculateTrainingMax } from "@/lib/trainingMax";
import { suggestAttempts, kgToLb } from "@/lib/meetPrep/attemptPlanner";
import { generateWarmup } from "@/lib/meetPrep/warmup";
import { BENCH_WEAKNESS_OPTIONS, DEADLIFT_WEAKNESS_OPTIONS } from "@/lib/meetPrep/weaknesses";

const TABS = ["Overview", "Program", "Progress", "History", "Badges", "Messages"] as const;

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  paid_programming: "Programming",
  paid_coaching: "Coaching",
};

export function ClientDetailView({
  profile,
  program,
  measurements,
  prs,
  workoutLogs,
  achievements,
  notes,
  templates,
  trainingMaxes,
  jokerRequests,
}: {
  profile: Profile;
  program: Program | null;
  measurements: Measurement[];
  prs: PR[];
  workoutLogs: WorkoutLog[];
  achievements: Achievement[];
  notes: CoachNote[];
  templates: { id: string; goal: string; name: string }[];
  trainingMaxes: TrainingMax[];
  jokerRequests: JokerRequest[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  return (
    <div>
      <Link href="/coach" className="text-jcf-gray text-xs uppercase tracking-widest hover:text-jcf-gold">
        ← All Clients
      </Link>
      <div className="flex items-center justify-between mt-2 mb-6">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wide">{profile.full_name ?? profile.email}</h1>
          <p className="text-jcf-gray text-sm">
            {profile.email} · {profile.goal?.replace("_", " ") ?? "no goal"} ·{" "}
            <span className="text-jcf-gold">{TIER_LABELS[profile.tier] ?? profile.tier}</span>
          </p>
        </div>
        {!profile.is_active && <span className="text-jcf-danger text-xs uppercase">Inactive</span>}
      </div>

      <div className="flex gap-2 overflow-x-auto jcf-scrollbar mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-3 py-2 text-xs uppercase tracking-wide rounded-sm border ${
              tab === t ? "bg-jcf-gold text-jcf-black border-jcf-gold font-semibold" : "border-white/15 text-jcf-gray"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab profile={profile} />}
      {tab === "Program" && (
        <ProgramTab
          profile={profile}
          program={program}
          templates={templates}
          trainingMaxes={trainingMaxes}
          jokerRequests={jokerRequests}
          workoutLogs={workoutLogs}
        />
      )}
      {tab === "Progress" && <ProgressTab measurements={measurements} prs={prs} />}
      {tab === "History" && <HistoryTab logs={workoutLogs} />}
      {tab === "Badges" && <BadgesTab achievements={achievements} />}
      {tab === "Messages" && (
        <div className="h-[60vh] flex flex-col">
          <MessageThread initialNotes={notes} profileId={profile.id} viewerRole="coach" />
        </div>
      )}
    </div>
  );
}

function OverviewTab({ profile }: { profile: Profile }) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [birthday, setBirthday] = useState(profile.birthday ?? "");
  const [heightIn, setHeightIn] = useState(profile.height_in?.toString() ?? "");
  const [currentWeight, setCurrentWeight] = useState(profile.current_weight?.toString() ?? "");
  const [tier, setTier] = useState(profile.tier);
  const [saving, setSaving] = useState(false);
  const [savingTier, setSavingTier] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/clients/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          birthday: birthday || null,
          height_in: heightIn ? Number(heightIn) : null,
          current_weight: currentWeight ? Number(currentWeight) : null,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function changeTier(newTier: string) {
    setTier(newTier as Profile["tier"]);
    setSavingTier(true);
    try {
      await fetch(`/api/clients/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: newTier }),
      });
    } finally {
      setSavingTier(false);
    }
  }

  async function sendPasswordReset() {
    const res = await fetch(`/api/clients/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sendPasswordReset: true }),
    });
    const data = await res.json();
    setResetMessage(res.ok ? "Password reset email sent." : data.error ?? "Could not send reset email.");
  }

  async function toggleActive() {
    if (profile.is_active) {
      await fetch(`/api/clients/${profile.id}`, { method: "DELETE" });
    } else {
      await fetch(`/api/clients/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });
    }
    location.reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-jcf-panel border border-white/10 rounded-sm p-4">
        <h3 className="text-xs uppercase tracking-widest text-jcf-gold mb-3">Profile</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input label="Birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          <Input label="Height (in)" type="number" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} />
          <Input label="Current Weight (lb)" type="number" value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)} />
        </div>
        <Button onClick={save} disabled={saving} className="mt-4">{saving ? "Saving..." : "Save Changes"}</Button>
      </div>

      <div className="bg-jcf-panel border border-white/10 rounded-sm p-4">
        <h3 className="text-xs uppercase tracking-widest text-jcf-gold mb-3">Tier</h3>
        <select
          value={tier}
          onChange={(e) => changeTier(e.target.value)}
          disabled={savingTier}
          className="bg-jcf-black border border-white/15 rounded-sm px-3 py-2.5 text-white text-sm focus:outline-none focus:border-jcf-gold"
        >
          <option value="free">Free</option>
          <option value="paid_programming">Programming</option>
          <option value="paid_coaching">Coaching</option>
        </select>
        <p className="text-jcf-gray text-xs mt-2">
          Manually changing tier here does not touch Stripe billing — use this for grandfathering,
          comps, or fixing a mismatch, not as a substitute for the client subscribing.
        </p>
      </div>

      <div className="bg-jcf-panel border border-white/10 rounded-sm p-4">
        <h3 className="text-xs uppercase tracking-widest text-jcf-gold mb-3">Account</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={sendPasswordReset}>Send Password Reset Email</Button>
          <Button variant={profile.is_active ? "danger" : "secondary"} onClick={toggleActive}>
            {profile.is_active ? "Deactivate Client" : "Reactivate Client"}
          </Button>
        </div>
        {resetMessage && <p className="text-sm mt-3 text-jcf-gray">{resetMessage}</p>}
      </div>
    </div>
  );
}

function ProgramTab({
  profile,
  program,
  templates,
  trainingMaxes,
  jokerRequests,
  workoutLogs,
}: {
  profile: Profile;
  program: Program | null;
  templates: { id: string; goal: string; name: string }[];
  trainingMaxes: TrainingMax[];
  jokerRequests: JokerRequest[];
  workoutLogs: WorkoutLog[];
}) {
  const [swapping, setSwapping] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const flat = flattenProgram(program);
  const trainingMaxRecord: Record<string, number> = {};
  for (const tm of trainingMaxes) trainingMaxRecord[tm.lift] = Number(tm.weight);

  async function swapProgram(templateId: string) {
    setSwapping(true);
    try {
      const template = templates.find((t) => t.id === templateId);
      if (!template) return;
      await fetch(`/api/clients/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: template.goal, program_id: templateId }),
      });
      location.reload();
    } finally {
      setSwapping(false);
    }
  }

  return (
    <div>
      {program ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-display uppercase text-white">{program.name}</div>
              <div className="text-jcf-gray text-sm">{program.description}</div>
            </div>
            <Link
              href={`/coach/templates/${program.id}`}
              className="text-xs uppercase tracking-widest text-jcf-gold hover:underline"
            >
              Edit This Program
            </Link>
          </div>
          <div className="flex flex-col gap-2 mb-4">
            {flat.map((d) => (
              <div key={d.index} className="bg-jcf-panel border border-white/10 rounded-sm p-3">
                <div className="text-xs text-jcf-gray uppercase tracking-widest mb-1">Week {d.week}</div>
                <div className="font-display uppercase text-sm">{d.label}</div>
                <div className="text-xs text-jcf-gray mt-1">
                  {d.exercises.map((e) => e.name).join(" · ")}
                </div>
              </div>
            ))}
          </div>
          <Button variant="secondary" onClick={() => setPreviewOpen((v) => !v)} className="w-full mb-6">
            {previewOpen ? "Hide" : "Preview"} What {profile.full_name?.split(" ")[0] ?? "He"} Sees
          </Button>
          {previewOpen && (
            <div className="mb-6">
              <ProgramPreview days={flat} trainingMaxes={trainingMaxRecord} recentLogs={workoutLogs} />
            </div>
          )}
        </>
      ) : (
        <p className="text-jcf-gray text-sm mb-6">No program assigned.</p>
      )}

      <div className="bg-jcf-panel border border-white/10 rounded-sm p-4 mb-6">
        <h3 className="text-xs uppercase tracking-widest text-jcf-gold mb-3">Swap Program Template</h3>
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <Button key={t.id} variant="secondary" disabled={swapping} onClick={() => swapProgram(t.id)}>
              {t.name}
            </Button>
          ))}
        </div>
      </div>

      <MeetPrepTmPanel profileId={profile.id} trainingMaxes={trainingMaxes} />
      <div className="mt-6">
        <JokerRequestsPanel jokerRequests={jokerRequests} />
      </div>
      <div className="mt-6">
        <ComplianceTrendPanel profileId={profile.id} />
      </div>
      {program && (
        <div className="mt-6">
          <AttemptPlanPanel program={program} trainingMaxes={trainingMaxes} />
        </div>
      )}
      {program && (
        <div className="mt-6">
          <WeaknessesPanel program={program} />
        </div>
      )}
    </div>
  );
}

const EMPTY_ATTEMPT: AttemptEntry = { opener: null, second: null, third: null };

function AttemptPlanPanel({ program, trainingMaxes }: { program: Program; trainingMaxes: TrainingMax[] }) {
  const existing = program.attempt_plan;
  const [bench, setBench] = useState<AttemptEntry>(existing?.bench ?? EMPTY_ATTEMPT);
  const [deadlift, setDeadlift] = useState<AttemptEntry>(existing?.deadlift ?? EMPTY_ATTEMPT);
  const [released, setReleased] = useState(existing?.released ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function suggestFor(lift: "meet_bench" | "meet_deadlift", setEntry: (e: AttemptEntry) => void) {
    const oneRm = trainingMaxes.find((t) => t.lift === lift)?.one_rm;
    if (!oneRm) return;
    const s = suggestAttempts(Number(oneRm), 2.5);
    setEntry({ opener: s.opener, second: s.second, third: s.thirdStandard });
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const attemptPlan: AttemptPlan = { bench, deadlift, released };
      await fetch(`/api/templates/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt_plan: attemptPlan }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-jcf-panel border border-white/10 rounded-sm p-4">
      <h3 className="text-xs uppercase tracking-widest text-jcf-gold mb-1">Competition Attempts</h3>
      <p className="text-jcf-gray text-xs mb-4">Kg, coach-approved. Release to show the athlete their planned openers.</p>

      <AttemptLiftRow
        label="Bench"
        entry={bench}
        onChange={setBench}
        onSuggest={() => suggestFor("meet_bench", setBench)}
      />
      <div className="mt-4">
        <AttemptLiftRow
          label="Deadlift"
          entry={deadlift}
          onChange={setDeadlift}
          onSuggest={() => suggestFor("meet_deadlift", setDeadlift)}
        />
      </div>

      <label className="flex items-center gap-2 mt-4 text-xs text-jcf-gray">
        <input type="checkbox" checked={released} onChange={(e) => setReleased(e.target.checked)} />
        Released to athlete
      </label>

      <Button onClick={save} disabled={saving} variant="secondary" className="mt-3">
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
      </Button>
    </div>
  );
}

function AttemptLiftRow({
  label,
  entry,
  onChange,
  onSuggest,
}: {
  label: string;
  entry: AttemptEntry;
  onChange: (e: AttemptEntry) => void;
  onSuggest: () => void;
}) {
  const warmup = entry.opener ? generateWarmup(entry.opener, 2.5) : null;
  return (
    <div className="border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-display uppercase tracking-wide">{label}</div>
        <button type="button" onClick={onSuggest} className="text-[10px] uppercase tracking-widest text-jcf-gold hover:underline">
          Suggest from 1RM
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(["opener", "second", "third"] as const).map((field) => (
          <div key={field}>
            <Input
              label={`${field[0].toUpperCase()}${field.slice(1)} (kg)`}
              type="number"
              value={entry[field] ?? ""}
              onChange={(e) => onChange({ ...entry, [field]: e.target.value ? Number(e.target.value) : null })}
            />
            {entry[field] != null && (
              <p className="text-[10px] text-jcf-gray mt-1">{kgToLb(entry[field] as number)} lb</p>
            )}
          </div>
        ))}
      </div>
      {warmup && (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-widest text-jcf-gray mb-1">Warm-Up (to opener)</p>
          <div className="flex flex-wrap gap-2">
            {warmup.map((w, i) => (
              <span key={i} className="text-[11px] text-jcf-gray bg-jcf-black border border-white/10 rounded-sm px-2 py-1">
                {w.weight}kg × {w.reps}
              </span>
            ))}
            <span className="text-[11px] text-jcf-gold bg-jcf-black border border-jcf-gold/30 rounded-sm px-2 py-1">
              {entry.opener}kg × 1 (opener)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function WeaknessesPanel({ program }: { program: Program }) {
  const existing = program.weaknesses;
  const [bench, setBench] = useState<string[]>(existing?.bench ?? []);
  const [deadlift, setDeadlift] = useState<string[]>(existing?.deadlift ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(list: string[], key: string, setList: (v: string[]) => void) {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const weaknesses: ProgramWeaknesses = { bench, deadlift };
      await fetch(`/api/templates/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weaknesses }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-jcf-panel border border-white/10 rounded-sm p-4">
      <h3 className="text-xs uppercase tracking-widest text-jcf-gold mb-1">Weaknesses</h3>
      <p className="text-jcf-gray text-xs mb-4">
        Reference for accessory selection — edit exercises directly via Edit This Program.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-jcf-gray mb-2">Bench</p>
          <div className="flex flex-col gap-1.5">
            {BENCH_WEAKNESS_OPTIONS.map((opt) => (
              <label key={opt.key} className="flex items-center gap-2 text-xs text-white">
                <input
                  type="checkbox"
                  checked={bench.includes(opt.key)}
                  onChange={() => toggle(bench, opt.key, setBench)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-jcf-gray mb-2">Deadlift</p>
          <div className="flex flex-col gap-1.5">
            {DEADLIFT_WEAKNESS_OPTIONS.map((opt) => (
              <label key={opt.key} className="flex items-center gap-2 text-xs text-white">
                <input
                  type="checkbox"
                  checked={deadlift.includes(opt.key)}
                  onChange={() => toggle(deadlift, opt.key, setDeadlift)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </div>
      <Button onClick={save} disabled={saving} variant="secondary" className="mt-4">
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
      </Button>
    </div>
  );
}

function JokerRequestsPanel({ jokerRequests }: { jokerRequests: JokerRequest[] }) {
  const [items, setItems] = useState(jokerRequests);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function resolve(id: string, status: "approved" | "denied", coachResponse?: string) {
    setBusy((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/joker-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, coachResponse }),
      });
      const data = await res.json();
      if (res.ok) {
        setItems((prev) => prev.map((r) => (r.id === id ? data.jokerRequest : r)));
      }
    } finally {
      setBusy((prev) => ({ ...prev, [id]: false }));
    }
  }

  const pending = items.filter((r) => r.status === "pending");
  const resolved = items.filter((r) => r.status !== "pending");

  return (
    <div className="bg-jcf-panel border border-white/10 rounded-sm p-4">
      <h3 className="text-xs uppercase tracking-widest text-jcf-gold mb-3">Joker Requests</h3>
      {pending.length === 0 && <p className="text-jcf-gray text-sm mb-3">No pending requests.</p>}
      <div className="flex flex-col gap-2 mb-4">
        {pending.map((r) => (
          <div key={r.id} className="border border-white/10 rounded-sm p-3">
            <div className="text-sm text-white mb-1">
              Week {r.week_number} · {r.lift === "meet_bench" ? "Bench" : "Deadlift"}
            </div>
            <div className="text-xs text-jcf-gray mb-2">
              Top single {r.top_single_weight}kg @ RPE {r.top_single_rpe} — up to {r.max_permitted_weight}kg requested.
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={busy[r.id]} onClick={() => resolve(r.id, "approved")}>
                Approve
              </Button>
              <Button variant="danger" disabled={busy[r.id]} onClick={() => resolve(r.id, "denied")}>
                Deny
              </Button>
            </div>
          </div>
        ))}
      </div>
      {resolved.length > 0 && (
        <>
          <h4 className="text-[10px] uppercase tracking-widest text-jcf-gray mb-2">History</h4>
          <div className="flex flex-col gap-1.5">
            {resolved.slice(0, 10).map((r) => (
              <div key={r.id} className="text-xs text-jcf-gray flex justify-between">
                <span>
                  Week {r.week_number} · {r.lift === "meet_bench" ? "Bench" : "Deadlift"}
                </span>
                <span>{r.status}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ComplianceTrendPanel({ profileId }: { profileId: string }) {
  const [weeks, setWeeks] = useState<{ week: number; score: number; category: string }[] | null>(null);

  useEffect(() => {
    fetch(`/api/compliance?profileId=${profileId}`)
      .then((res) => res.json())
      .then((data) => setWeeks(data.weeks ?? []))
      .catch(() => setWeeks([]));
  }, [profileId]);

  if (!weeks) return null;

  const current = weeks[weeks.length - 1];
  const chartData = weeks.map((w) => ({ week: `W${w.week}`, score: w.score }));

  return (
    <div className="bg-jcf-panel border border-white/10 rounded-sm p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs uppercase tracking-widest text-jcf-gold">Compliance Trend</h3>
        {current && (
          <span className="text-sm text-white">
            {current.score}% <span className="text-jcf-gray text-xs">({current.category})</span>
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData}>
          <CartesianGrid stroke="#2a2a2a" vertical={false} />
          <XAxis dataKey="week" stroke="#8A8A8A" fontSize={10} />
          <YAxis stroke="#8A8A8A" fontSize={10} domain={[0, 100]} />
          <Tooltip contentStyle={{ background: "#151515", border: "1px solid #333", fontSize: 12 }} />
          <Line type="monotone" dataKey="score" stroke="#D9A125" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MeetPrepTmPanel({ profileId, trainingMaxes }: { profileId: string; trainingMaxes: TrainingMax[] }) {
  const LIFTS: { lift: "meet_bench" | "meet_deadlift"; label: string }[] = [
    { lift: "meet_bench", label: "Bench" },
    { lift: "meet_deadlift", label: "Deadlift" },
  ];

  return (
    <div className="bg-jcf-panel border border-white/10 rounded-sm p-4">
      <h3 className="text-xs uppercase tracking-widest text-jcf-gold mb-1">Meet Prep Training Maxes</h3>
      <p className="text-jcf-gray text-xs mb-3">
        Separate from the standard hit/miss training max — kg-based, 90% of entered 1RM, coach-approved.
      </p>
      <div className="flex flex-col gap-4">
        {LIFTS.map(({ lift, label }) => (
          <MeetPrepTmRow
            key={lift}
            profileId={profileId}
            lift={lift}
            label={label}
            existing={trainingMaxes.find((t) => t.lift === lift) ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function MeetPrepTmRow({
  profileId,
  lift,
  label,
  existing,
}: {
  profileId: string;
  lift: "meet_bench" | "meet_deadlift";
  label: string;
  existing: TrainingMax | null;
}) {
  const [oneRm, setOneRm] = useState(existing?.one_rm?.toString() ?? "");
  const [approvedTm, setApprovedTm] = useState(existing?.weight?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const oneRmNum = Number(oneRm);
  const calculatedTm = oneRmNum > 0 ? calculateTrainingMax(oneRmNum) : null;

  async function save() {
    if (!oneRmNum) return;
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/training-maxes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          lift,
          oneRm: oneRmNum,
          unit: "kg",
          tmPercent: 90,
          approvedTm: approvedTm ? Number(approvedTm) : calculatedTm,
        }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
      <div className="text-sm font-display uppercase tracking-wide mb-2">{label}</div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="1RM (kg)" type="number" value={oneRm} onChange={(e) => setOneRm(e.target.value)} />
        <Input
          label="Approved TM (kg)"
          type="number"
          value={approvedTm}
          onChange={(e) => setApprovedTm(e.target.value)}
          placeholder={calculatedTm != null ? String(calculatedTm) : undefined}
        />
      </div>
      {calculatedTm != null && (
        <p className="text-jcf-gray text-xs mt-2">Calculated 90% TM: {calculatedTm} kg</p>
      )}
      <Button onClick={save} disabled={saving || !oneRmNum} variant="secondary" className="mt-3">
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
      </Button>
    </div>
  );
}

function ProgressTab({ measurements, prs }: { measurements: Measurement[]; prs: PR[] }) {
  const weightData = measurements.filter((m) => m.weight != null).map((m) => ({ date: m.date.slice(5), weight: m.weight }));
  return (
    <div>
      {weightData.length > 0 && (
        <div className="bg-jcf-panel border border-white/10 rounded-sm p-4 mb-4">
          <h3 className="text-xs uppercase tracking-widest text-jcf-gray mb-3">Weight Trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weightData}>
              <CartesianGrid stroke="#2a2a2a" vertical={false} />
              <XAxis dataKey="date" stroke="#8A8A8A" fontSize={10} />
              <YAxis stroke="#8A8A8A" fontSize={10} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: "#151515", border: "1px solid #333", fontSize: 12 }} />
              <Line type="monotone" dataKey="weight" stroke="#D9A125" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <h3 className="text-xs uppercase tracking-widest text-jcf-gray mb-2">PR History</h3>
      <div className="flex flex-col gap-2">
        {[...prs].reverse().map((p) => (
          <div key={p.id} className="bg-jcf-panel border border-white/10 rounded-sm px-4 py-3 flex justify-between text-sm">
            <span>{p.lift}</span>
            <span className="text-jcf-gold">{p.weight} {p.unit ?? "lb"} x {p.reps}</span>
            <span className="text-jcf-gray">{p.date}</span>
          </div>
        ))}
        {prs.length === 0 && <p className="text-jcf-gray text-sm">No PRs logged yet.</p>}
      </div>
    </div>
  );
}

function HistoryTab({ logs }: { logs: WorkoutLog[] }) {
  const [expanded, setExpanded] = useState<string | null>(logs[0]?.id ?? null);
  return (
    <div className="flex flex-col gap-2">
      {logs.map((log) => {
        const isOpen = expanded === log.id;
        return (
          <div key={log.id} className="bg-jcf-panel border border-white/10 rounded-sm px-4 py-3">
            <button
              className="flex items-center justify-between w-full text-left"
              onClick={() => setExpanded(isOpen ? null : log.id)}
            >
              <span className="text-sm">{log.day_label ?? "Workout"}</span>
              <span className="text-jcf-gray text-xs">
                {log.date} {isOpen ? "▲" : "▼"}
              </span>
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
      {logs.length === 0 && <p className="text-jcf-gray text-sm">No workouts logged yet.</p>}
    </div>
  );
}

function BadgesTab({ achievements }: { achievements: Achievement[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {achievements.map((a) => (
        <div key={a.id} className="bg-jcf-gold/10 border border-jcf-gold/50 rounded-sm p-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2 bg-jcf-gold text-jcf-black">
            <AchievementIcon icon={a.icon} className="w-4 h-4" />
          </div>
          <div className="font-display uppercase text-sm text-white mb-1">{a.title}</div>
          <div className="text-xs text-jcf-gray">{a.description}</div>
          <div className="text-[10px] text-jcf-gold mt-2 uppercase tracking-widest">{a.date_earned}</div>
        </div>
      ))}
      {achievements.length === 0 && <p className="text-jcf-gray text-sm col-span-2">No achievements earned yet.</p>}
    </div>
  );
}
