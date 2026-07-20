"use client";
import { useState } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { MessageThread } from "@/components/MessageThread";
import { flattenProgram } from "@/lib/program";
import { formatSets } from "@/lib/workoutHistory";
import type { Achievement, CoachNote, Measurement, PR, Profile, Program, WorkoutLog } from "@/lib/types";

const TABS = ["Overview", "Program", "Progress", "History", "Badges", "Messages"] as const;

export function ClientDetailView({
  profile,
  program,
  measurements,
  prs,
  workoutLogs,
  achievements,
  notes,
  templates,
}: {
  profile: Profile;
  program: Program | null;
  measurements: Measurement[];
  prs: PR[];
  workoutLogs: WorkoutLog[];
  achievements: Achievement[];
  notes: CoachNote[];
  templates: { id: string; goal: string; name: string }[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  return (
    <div>
      <Link href="/coach" className="text-jcf-gray text-xs uppercase tracking-widest hover:text-jcf-gold">
        ← All Clients
      </Link>
      <div className="flex items-center justify-between mt-2 mb-6">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wide">{profile.full_name ?? profile.username}</h1>
          <p className="text-jcf-gray text-sm">@{profile.username} · {profile.goal?.replace("_", " ") ?? "no goal"}</p>
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
      {tab === "Program" && <ProgramTab profile={profile} program={program} templates={templates} />}
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
  const [saving, setSaving] = useState(false);
  const [pinResult, setPinResult] = useState<string | null>(null);

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

  async function resetPin() {
    const res = await fetch(`/api/clients/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetPin: true }),
    });
    const data = await res.json();
    if (res.ok) setPinResult(data.pin);
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
        <h3 className="text-xs uppercase tracking-widest text-jcf-gold mb-3">Account</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={resetPin}>Reset PIN</Button>
          <Button variant={profile.is_active ? "danger" : "secondary"} onClick={toggleActive}>
            {profile.is_active ? "Deactivate Client" : "Reactivate Client"}
          </Button>
        </div>
        {pinResult && (
          <p className="text-sm mt-3">
            New PIN: <span className="text-jcf-gold font-semibold">{pinResult}</span> — share this with the client.
          </p>
        )}
      </div>
    </div>
  );
}

function ProgramTab({
  profile,
  program,
  templates,
}: {
  profile: Profile;
  program: Program | null;
  templates: { id: string; goal: string; name: string }[];
}) {
  const [swapping, setSwapping] = useState(false);
  const flat = flattenProgram(program);

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
          <div className="flex flex-col gap-2 mb-6">
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
        </>
      ) : (
        <p className="text-jcf-gray text-sm mb-6">No program assigned.</p>
      )}

      <div className="bg-jcf-panel border border-white/10 rounded-sm p-4">
        <h3 className="text-xs uppercase tracking-widest text-jcf-gold mb-3">Swap Program Template</h3>
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <Button key={t.id} variant="secondary" disabled={swapping} onClick={() => swapProgram(t.id)}>
              {t.name}
            </Button>
          ))}
        </div>
      </div>
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
            <span className="text-jcf-gold">{p.weight} lb x {p.reps}</span>
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
          <div className="font-display uppercase text-sm text-white mb-1">{a.title}</div>
          <div className="text-xs text-jcf-gray">{a.description}</div>
          <div className="text-[10px] text-jcf-gold mt-2 uppercase tracking-widest">{a.date_earned}</div>
        </div>
      ))}
      {achievements.length === 0 && <p className="text-jcf-gray text-sm col-span-2">No achievements earned yet.</p>}
    </div>
  );
}
