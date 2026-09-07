"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { JcfLogo } from "@/components/JcfLogo";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import type { ExperienceLevel, Goal, Sex, UnitSystem } from "@/lib/types";
import { calculateNutritionTargets, weightToPounds } from "@/lib/onboarding";

const GOALS: { id: Goal; label: string; desc: string }[] = [
  { id: "fat_loss", label: "Fat Loss", desc: "Lose body fat while keeping strength and muscle." },
  { id: "recomposition", label: "Recomposition", desc: "Build muscle while gradually leaning out." },
  { id: "muscle_gain", label: "Muscle Gain", desc: "Prioritize hypertrophy, recovery, and progressive overload." },
  { id: "strength", label: "Strength", desc: "Build measurable strength around the major movement patterns." },
];

const EQUIPMENT = [
  ["full_gym", "Full gym"],
  ["barbell_rack", "Barbell + rack"],
  ["dumbbells", "Dumbbells"],
  ["machines_cables", "Machines + cables"],
  ["resistance_bands", "Resistance bands"],
  ["cardio_equipment", "Cardio equipment"],
  ["bodyweight", "Bodyweight only"],
] as const;

const DIETARY_PREFERENCES = [
  ["no_restrictions", "No restrictions"],
  ["vegetarian", "Vegetarian"],
  ["vegan", "Vegan"],
  ["pescatarian", "Pescatarian"],
  ["dairy_free", "Dairy-free"],
  ["gluten_free", "Gluten-free"],
  ["low_carb", "Lower carb"],
] as const;

const EXPERIENCE: { id: ExperienceLevel; label: string; desc: string }[] = [
  { id: "beginner", label: "Beginner", desc: "Less than one consistent year." },
  { id: "intermediate", label: "Intermediate", desc: "One to three consistent years." },
  { id: "advanced", label: "Advanced", desc: "Three or more consistent years." },
];

function normalizeGoal(goal: string | null): Goal | null {
  if (goal === "strength_gain") return "muscle_gain";
  if (goal === "hybrid") return "recomposition";
  if (goal === "powerlifting") return "strength";
  return GOALS.some((option) => option.id === goal) ? goal as Goal : null;
}

function Choice({ selected, title, description, onClick }: {
  selected: boolean;
  title: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`text-left border rounded-sm p-3 transition-colors ${
        selected ? "border-jcf-gold bg-jcf-gold/10" : "border-white/15 hover:border-white/30"
      }`}
    >
      <span className="font-display uppercase text-sm tracking-wide block">{title}</span>
      {description && <span className="text-jcf-gray text-xs mt-0.5 block">{description}</span>}
    </button>
  );
}

export function OnboardingForm({ existingGoal, initialName }: {
  existingGoal: string | null;
  initialName: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(initialName ?? "");
  const [goal, setGoal] = useState<Goal | null>(normalizeGoal(existingGoal));
  const [sex, setSex] = useState<Sex | null>(null);
  const [age, setAge] = useState("");
  const [units, setUnits] = useState<UnitSystem>("imperial");
  const [height, setHeight] = useState("");
  const [heightRemainder, setHeightRemainder] = useState("");
  const [weight, setWeight] = useState("");
  const [experience, setExperience] = useState<ExperienceLevel | null>(null);
  const [trainingDays, setTrainingDays] = useState(4);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>(["no_restrictions"]);
  const [dietaryNotes, setDietaryNotes] = useState("");

  const targets = useMemo(() => {
    const value = Number(weight);
    if (!goal || !Number.isFinite(value) || value <= 0) return null;
    return calculateNutritionTargets(weightToPounds(value, units), goal);
  }, [goal, units, weight]);

  function changeUnits(next: UnitSystem) {
    if (next === units) return;
    setUnits(next);
    setHeight("");
    setHeightRemainder("");
    setWeight("");
  }

  function normalizedHeightInput(): number {
    return units === "imperial"
      ? Number(height) * 12 + Number(heightRemainder)
      : Number(height);
  }

  function toggleEquipment(id: string) {
    setEquipment((current) => {
      if (id === "full_gym" || id === "bodyweight") return current.includes(id) ? [] : [id];
      const withoutShortcuts = current.filter((value) => value !== "full_gym" && value !== "bodyweight");
      return withoutShortcuts.includes(id)
        ? withoutShortcuts.filter((value) => value !== id)
        : [...withoutShortcuts, id];
    });
  }

  function toggleDiet(id: string) {
    setDietaryPreferences((current) => {
      if (id === "no_restrictions") return [id];
      const restricted = current.filter((value) => value !== "no_restrictions");
      return restricted.includes(id) ? restricted.filter((value) => value !== id) : [...restricted, id];
    });
  }

  function continueFromBasics() {
    const numericAge = Number(age);
    const numericHeight = normalizedHeightInput();
    const numericWeight = Number(weight);
    const validRange = units === "metric"
      ? numericHeight >= 120 && numericHeight <= 230 && numericWeight >= 35 && numericWeight <= 350
      : numericHeight >= 48 && numericHeight <= 90 && numericWeight >= 80 && numericWeight <= 700;
    if (!fullName.trim() || !sex || numericAge < 13 || numericAge > 100 || !validRange) {
      setError("Complete each field with a valid value before continuing.");
      return;
    }
    setError(null);
    setStep(2);
  }

  async function submit() {
    if (!goal || !sex || !experience || !targets || equipment.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          goal,
          sex,
          age: Number(age),
          units,
          height: normalizedHeightInput(),
          weight: Number(weight),
          experience,
          trainingDays,
          equipment,
          dietaryPreferences,
          dietaryNotes,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Something went wrong while building your plan.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 sm:px-6 sm:py-10">
      <JcfLogo size="md" />
      <div className="w-full max-w-lg mt-5 mb-6">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-jcf-gray mb-2">
          <span>Build your plan</span>
          <span>Step {step + 1} of 5</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-jcf-gold transition-all" style={{ width: `${((step + 1) / 5) * 100}%` }} />
        </div>
      </div>

      <div className="w-full max-w-lg bg-jcf-panel border border-white/10 rounded-sm p-5 sm:p-7">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="font-display uppercase tracking-wide text-2xl text-jcf-gold">What are we building?</h1>
              <p className="text-jcf-gray text-sm mt-1">Choose the result that matters most right now.</p>
            </div>
            <div className="grid gap-2">
              {GOALS.map((option) => (
                <Choice key={option.id} selected={goal === option.id} title={option.label} description={option.desc} onClick={() => setGoal(option.id)} />
              ))}
            </div>
            <Button onClick={() => setStep(1)} disabled={!goal}>Continue</Button>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="font-display uppercase tracking-wide text-2xl text-jcf-gold">About you</h1>
              <p className="text-jcf-gray text-sm mt-1">These numbers set your starting nutrition targets.</p>
            </div>
            <Input id="full-name" label="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
            <fieldset>
              <legend className="text-xs uppercase tracking-wider text-jcf-gray mb-2">Sex</legend>
              <div className="grid grid-cols-2 gap-2">
                <Choice selected={sex === "female"} title="Female" onClick={() => setSex("female")} />
                <Choice selected={sex === "male"} title="Male" onClick={() => setSex("male")} />
              </div>
              <p className="text-jcf-gray text-[11px] mt-2">Used only for sex-specific body-composition estimates later.</p>
            </fieldset>
            <Input id="age" label="Age" type="number" inputMode="numeric" min={13} max={100} value={age} onChange={(event) => setAge(event.target.value)} required />
            <fieldset>
              <legend className="text-xs uppercase tracking-wider text-jcf-gray mb-2">Preferred units</legend>
              <div className="grid grid-cols-2 gap-2">
                <Choice selected={units === "imperial"} title="Lb / ft" onClick={() => changeUnits("imperial")} />
                <Choice selected={units === "metric"} title="Kg / cm" onClick={() => changeUnits("metric")} />
              </div>
            </fieldset>
            <div className={`grid gap-3 ${units === "imperial" ? "grid-cols-3" : "grid-cols-2"}`}>
              <Input id="height" label={units === "metric" ? "Height (cm)" : "Height (ft)"} type="number" inputMode="decimal" value={height} onChange={(event) => setHeight(event.target.value)} required />
              {units === "imperial" && <Input id="height-inches" label="Extra inches" type="number" inputMode="decimal" min={0} max={11.9} step="0.1" value={heightRemainder} onChange={(event) => setHeightRemainder(event.target.value)} required />}
              <Input id="weight" label={units === "metric" ? "Weight (kg)" : "Weight (lb)"} type="number" inputMode="decimal" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} required />
            </div>
            {error && <p role="alert" className="text-jcf-danger text-sm">{error}</p>}
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
              <Button onClick={continueFromBasics} className="flex-1">Continue</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="font-display uppercase tracking-wide text-2xl text-jcf-gold">Your training</h1>
              <p className="text-jcf-gray text-sm mt-1">We will fit the program to your experience and real schedule.</p>
            </div>
            <fieldset>
              <legend className="text-xs uppercase tracking-wider text-jcf-gray mb-2">Experience</legend>
              <div className="grid gap-2">
                {EXPERIENCE.map((option) => (
                  <Choice key={option.id} selected={experience === option.id} title={option.label} description={option.desc} onClick={() => setExperience(option.id)} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs uppercase tracking-wider text-jcf-gray mb-2">Training days per week</legend>
              <div className="grid grid-cols-5 gap-2">
                {[2, 3, 4, 5, 6].map((days) => (
                  <button key={days} type="button" aria-pressed={trainingDays === days} onClick={() => setTrainingDays(days)} className={`min-h-12 border rounded-sm font-display text-lg ${trainingDays === days ? "border-jcf-gold bg-jcf-gold/10 text-jcf-gold" : "border-white/15"}`}>{days}</button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs uppercase tracking-wider text-jcf-gray mb-2">Available equipment</legend>
              <div className="grid grid-cols-2 gap-2">
                {EQUIPMENT.map(([id, label]) => (
                  <Choice key={id} selected={equipment.includes(id)} title={label} onClick={() => toggleEquipment(id)} />
                ))}
              </div>
            </fieldset>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)} disabled={!experience || equipment.length === 0} className="flex-1">Continue</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="font-display uppercase tracking-wide text-2xl text-jcf-gold">How do you eat?</h1>
              <p className="text-jcf-gray text-sm mt-1">We will use this for food search, favorites, and meal suggestions.</p>
            </div>
            <fieldset>
              <legend className="sr-only">Dietary preferences</legend>
              <div className="grid grid-cols-2 gap-2">
                {DIETARY_PREFERENCES.map(([id, label]) => (
                  <Choice key={id} selected={dietaryPreferences.includes(id)} title={label} onClick={() => toggleDiet(id)} />
                ))}
              </div>
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dietary-notes" className="text-xs uppercase tracking-wider text-jcf-gray">Allergies or food notes</label>
              <textarea id="dietary-notes" rows={3} maxLength={500} value={dietaryNotes} onChange={(event) => setDietaryNotes(event.target.value)} className="bg-jcf-panel border border-white/15 rounded-sm px-3 py-2.5 text-white focus:outline-none focus:border-jcf-gold" placeholder="Optional" />
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)} className="flex-1">Review plan</Button>
            </div>
          </div>
        )}

        {step === 4 && goal && targets && experience && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-jcf-gray">Your starting point</p>
              <h1 className="font-display uppercase tracking-wide text-3xl text-jcf-gold mt-1">Ready to rebuild</h1>
              <p className="text-jcf-gray text-sm mt-2">Jon can adjust every target and exercise after you begin.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-white/10 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-widest text-jcf-gray">Goal</p><p className="font-display uppercase text-lg mt-1">{GOALS.find((option) => option.id === goal)?.label}</p></div>
              <div className="border border-white/10 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-widest text-jcf-gray">Training</p><p className="font-display uppercase text-lg mt-1">{trainingDays} days · {experience}</p></div>
            </div>
            <div className="border border-jcf-gold/40 bg-jcf-gold/5 p-4">
              <div className="flex items-end justify-between border-b border-white/10 pb-3 mb-3">
                <div><p className="text-[10px] uppercase tracking-widest text-jcf-gray">Daily target</p><p className="font-display text-4xl text-jcf-gold">{targets.targetCalories}</p></div>
                <p className="text-jcf-gray text-xs mb-1">Estimated maintenance {targets.maintenanceCalories}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="font-display text-xl">{targets.proteinGrams}g</p><p className="text-[10px] uppercase tracking-widest text-jcf-gray">Protein</p></div>
                <div><p className="font-display text-xl">{targets.carbGrams}g</p><p className="text-[10px] uppercase tracking-widest text-jcf-gray">Carbs</p></div>
                <div><p className="font-display text-xl">{targets.fatGrams}g</p><p className="text-[10px] uppercase tracking-widest text-jcf-gray">Fat</p></div>
              </div>
            </div>
            <p className="text-jcf-gray text-xs">Starting calories use the JCF bodyweight × 12 method. Fat Loss starts with a 15% reduction, capped at 500 calories, and no plan starts below 1,800 calories. Macros are 35% protein, 40% carbs, and 25% fat.</p>
            {error && <p role="alert" className="text-jcf-danger text-sm">{error}</p>}
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={submit} disabled={loading} className="flex-1">{loading ? "Building your plan..." : "Build my plan"}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
