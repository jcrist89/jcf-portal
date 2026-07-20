"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import type { Program, ProgramStructure, Exercise } from "@/lib/types";

export function TemplateEditor({ program }: { program: Program }) {
  const [name, setName] = useState(program.name);
  const [description, setDescription] = useState(program.description ?? "");
  const [structure, setStructure] = useState<ProgramStructure>(
    program.structure ?? { weeks: [] }
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateStructure(fn: (s: ProgramStructure) => ProgramStructure) {
    setStructure((prev) => fn(structuredClone(prev)));
    setSaved(false);
  }

  function addWeek() {
    updateStructure((s) => {
      const weekNum = s.weeks.length + 1;
      s.weeks.push({ week: weekNum, note: "", days: [] });
      return s;
    });
  }

  function removeWeek(wi: number) {
    updateStructure((s) => {
      s.weeks.splice(wi, 1);
      return s;
    });
  }

  function addDay(wi: number) {
    updateStructure((s) => {
      const dayNum = s.weeks[wi].days.length + 1;
      s.weeks[wi].days.push({ day: dayNum, label: `Day ${dayNum}`, exercises: [] });
      return s;
    });
  }

  function removeDay(wi: number, di: number) {
    updateStructure((s) => {
      s.weeks[wi].days.splice(di, 1);
      return s;
    });
  }

  function addExercise(wi: number, di: number) {
    updateStructure((s) => {
      s.weeks[wi].days[di].exercises.push({ name: "New Exercise", sets: 3, reps: "10", rest: "60 sec", notes: "" });
      return s;
    });
  }

  function removeExercise(wi: number, di: number, ei: number) {
    updateStructure((s) => {
      s.weeks[wi].days[di].exercises.splice(ei, 1);
      return s;
    });
  }

  function updateExercise(wi: number, di: number, ei: number, field: keyof Exercise, value: string) {
    updateStructure((s) => {
      (s.weeks[wi].days[di].exercises[ei] as any)[field] = value;
      return s;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, structure }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link href="/coach/templates" className="text-jcf-gray text-xs uppercase tracking-widest hover:text-jcf-gold">
        ← Templates
      </Link>

      <div className="mt-2 mb-6 flex flex-col gap-3">
        <Input label="Program Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="flex flex-col gap-6">
        {structure.weeks.map((week, wi) => (
          <div key={wi} className="border border-white/10 rounded-sm p-4 bg-jcf-panel">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display uppercase text-jcf-gold text-sm">Week {week.week}</span>
              <button onClick={() => removeWeek(wi)} className="text-jcf-danger text-xs uppercase">Remove Week</button>
            </div>
            <input
              value={week.note ?? ""}
              onChange={(e) =>
                updateStructure((s) => {
                  s.weeks[wi].note = e.target.value;
                  return s;
                })
              }
              placeholder="Week note (e.g. progression cue)"
              className="w-full bg-jcf-black border border-white/15 rounded-sm px-3 py-2 text-sm mb-4"
            />

            <div className="flex flex-col gap-4">
              {week.days.map((day, di) => (
                <div key={di} className="border border-white/10 rounded-sm p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      value={day.label}
                      onChange={(e) =>
                        updateStructure((s) => {
                          s.weeks[wi].days[di].label = e.target.value;
                          return s;
                        })
                      }
                      className="flex-1 bg-jcf-black border border-white/15 rounded-sm px-2 py-1.5 text-sm font-display uppercase"
                    />
                    <button onClick={() => removeDay(wi, di)} className="text-jcf-danger text-xs uppercase shrink-0">
                      Remove Day
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    {day.exercises.map((ex, ei) => (
                      <div key={ei} className="grid grid-cols-[1fr_3rem_3rem_4rem_auto] gap-1.5 items-center">
                        <input
                          value={ex.name}
                          onChange={(e) => updateExercise(wi, di, ei, "name", e.target.value)}
                          className="bg-jcf-black border border-white/15 rounded-sm px-2 py-1.5 text-xs"
                          placeholder="Exercise"
                        />
                        <input
                          value={ex.sets}
                          onChange={(e) => updateExercise(wi, di, ei, "sets", e.target.value)}
                          className="bg-jcf-black border border-white/15 rounded-sm px-1 py-1.5 text-xs text-center"
                          placeholder="Sets"
                        />
                        <input
                          value={ex.reps}
                          onChange={(e) => updateExercise(wi, di, ei, "reps", e.target.value)}
                          className="bg-jcf-black border border-white/15 rounded-sm px-1 py-1.5 text-xs text-center"
                          placeholder="Reps"
                        />
                        <input
                          value={ex.rest}
                          onChange={(e) => updateExercise(wi, di, ei, "rest", e.target.value)}
                          className="bg-jcf-black border border-white/15 rounded-sm px-1 py-1.5 text-xs text-center"
                          placeholder="Rest"
                        />
                        <button
                          onClick={() => removeExercise(wi, di, ei)}
                          className="text-jcf-danger text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => addExercise(wi, di)}
                    className="text-jcf-gold text-xs uppercase tracking-widest mt-2"
                  >
                    + Add Exercise
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => addDay(wi)} className="text-jcf-gold text-xs uppercase tracking-widest mt-3">
              + Add Day
            </button>
          </div>
        ))}
      </div>

      <button onClick={addWeek} className="text-jcf-gold text-xs uppercase tracking-widest mt-4 mb-8 block">
        + Add Week
      </button>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save Template"}
        </Button>
      </div>
    </div>
  );
}
