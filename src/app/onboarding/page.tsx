"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { JcfLogo } from "@/components/JcfLogo";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

const GOALS = [
  { id: "strength_gain", label: "Strength Gain", desc: "Lower reps, compound lifts, progressive overload." },
  { id: "fat_loss", label: "Fat Loss", desc: "Moderate reps, higher density, conditioning finishers." },
  { id: "hybrid", label: "Hybrid", desc: "Blend of strength work and conditioning." },
  { id: "powerlifting", label: "Powerlifting", desc: "Squat / bench / deadlift periodization." },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [startingWeight, setStartingWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [chest, setChest] = useState("");
  const [hips, setHips] = useState("");
  const [arms, setArms] = useState("");
  const [thighs, setThighs] = useState("");
  const [goal, setGoal] = useState<string | null>(null);

  async function submit() {
    if (!goal) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          birthday: birthday || null,
          heightIn: heightIn ? Number(heightIn) : null,
          startingWeight: startingWeight ? Number(startingWeight) : null,
          goal,
          measurements: { waist, chest, hips, arms, thighs },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-10">
      <JcfLogo size="md" />
      <p className="text-jcf-gray text-xs uppercase tracking-widest mt-2 mb-8">
        Step {step + 1} of 3
      </p>

      <div className="w-full max-w-md bg-jcf-panel border border-white/10 rounded-sm p-6">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-display uppercase tracking-wide text-jcf-gold">About You</h2>
            <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            <Input label="Birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
            <Input
              label="Height (inches)"
              type="number"
              value={heightIn}
              onChange={(e) => setHeightIn(e.target.value)}
              placeholder="e.g. 70"
            />
            <Input
              label="Starting Weight (lb)"
              type="number"
              value={startingWeight}
              onChange={(e) => setStartingWeight(e.target.value)}
            />
            <Button onClick={() => setStep(1)} disabled={!fullName} className="mt-2">
              Continue
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-display uppercase tracking-wide text-jcf-gold">Initial Measurements</h2>
            <p className="text-jcf-gray text-xs -mt-2">Optional, but helpful for tracking progress. All in inches.</p>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Waist" type="number" value={waist} onChange={(e) => setWaist(e.target.value)} />
              <Input label="Chest" type="number" value={chest} onChange={(e) => setChest(e.target.value)} />
              <Input label="Hips" type="number" value={hips} onChange={(e) => setHips(e.target.value)} />
              <Input label="Arms" type="number" value={arms} onChange={(e) => setArms(e.target.value)} />
              <Input label="Thighs" type="number" value={thighs} onChange={(e) => setThighs(e.target.value)} />
            </div>
            <div className="flex gap-3 mt-2">
              <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
              <Button onClick={() => setStep(2)} className="flex-1">Continue</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-display uppercase tracking-wide text-jcf-gold">Pick Your Goal</h2>
            <p className="text-jcf-gray text-xs -mt-2">This assigns your starting program. Jon can adjust it later.</p>
            <div className="flex flex-col gap-2">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGoal(g.id)}
                  className={`text-left border rounded-sm p-3 transition-colors ${
                    goal === g.id ? "border-jcf-gold bg-jcf-gold/10" : "border-white/15 hover:border-white/30"
                  }`}
                >
                  <div className="font-display uppercase text-sm tracking-wide">{g.label}</div>
                  <div className="text-jcf-gray text-xs mt-0.5">{g.desc}</div>
                </button>
              ))}
            </div>
            {error && <p className="text-jcf-danger text-sm">{error}</p>}
            <div className="flex gap-3 mt-2">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={submit} disabled={!goal || loading} className="flex-1">
                {loading ? "Setting up..." : "Finish Setup"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
